import {
    bufferWrapUint8Array,
    Device,
    DeviceConnectReason,
    DeviceCreateIgnoredError,
    type DeviceDisconnectReason,
    type DeviceEvents,
    DeviceState,
} from '@web-auto/android-auto';
import assert from 'assert';
import {
    Device as UsbDeviceImpl,
    InEndpoint,
    LibUSBException,
    OutEndpoint,
    usb,
} from 'usb';

export type UsbDeviceWrapperEndpointTransferOutFunction = (
    buffer: Uint8Array,
) => Promise<void>;

export type UsbDeviceWrapperEndpointPollFunction = (buffer: Buffer) => void;
export type UsbDeviceWrapperEndpointErrorFunction = (err: Error) => void;

export type UsbDeviceWrapperEndpointStartStopPollFunction = (
    callback: UsbDeviceWrapperEndpointPollFunction,
    errorCallback: UsbDeviceWrapperEndpointErrorFunction,
) => void;

enum StringType {
    MANUFACTURER,
    MODEL,
    DESCRIPTION,
    VERSION,
    URI,
    SERIAL,
}

const INTERFACE_INDEX = 0;

const GOOGLE_VENDOR_ID = 0x18d1;
const GOOGLE_AOAP_IDS = [0x2d00, 0x2d01, 0x2d02, 0x2d03, 0x2d04, 0x2d05];

export class UsbDevice extends Device {
    private opened = false;
    private inEndpoint: InEndpoint | undefined;
    private outEndpoint: OutEndpoint | undefined;
    public vendorId: number;
    public productId: number;

    public constructor(
        private device: UsbDeviceImpl,
        name: string,
        serial: string,
        events: DeviceEvents,
    ) {
        super('USB', name, serial, events);

        this.vendorId = this.device.deviceDescriptor.idVendor;
        this.productId = this.device.deviceDescriptor.idProduct;
    }

    public static getStringDescriptor(
        device: UsbDeviceImpl,
        index: number,
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            device.getStringDescriptor(index, (error, value) => {
                if (error !== undefined) {
                    return reject(error);
                }

                if (value === undefined) {
                    value = '';
                }

                resolve(value);
            });
        });
    }

    public static async getNameAndSerial(
        device: UsbDeviceImpl,
    ): Promise<[string, string]> {
        const descriptor = device.deviceDescriptor;

        if (descriptor.bDeviceClass !== 0) {
            throw new DeviceCreateIgnoredError('Device class not 0');
        }

        const name = await this.getStringDescriptor(
            device,
            descriptor.iProduct,
        );

        if (name === '') {
            throw new DeviceCreateIgnoredError('Empty name');
        }

        const serial = await this.getStringDescriptor(
            device,
            descriptor.iSerialNumber,
        );

        if (serial === '') {
            throw new DeviceCreateIgnoredError('Empty serial');
        }

        return [name, serial];
    }

    public static async create(
        device: UsbDeviceImpl,
        events: DeviceEvents,
    ): Promise<UsbDevice | undefined> {
        let name, serial;
        try {
            device.open();
            [name, serial] = await this.getNameAndSerial(device);
        } finally {
            device.close();
        }

        return new UsbDevice(device, name, serial, events);
    }

    public vendorControlTransferIn(
        request: number,
        value: number,
        index: number,
        length: number,
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            this.device.controlTransfer(
                usb.LIBUSB_ENDPOINT_IN | usb.LIBUSB_REQUEST_TYPE_VENDOR,
                request,
                value,
                index,
                length,
                (
                    error: LibUSBException | undefined,
                    buffer: number | Buffer | undefined,
                ) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve(buffer as Buffer);
                },
            );
        });
    }

    public vendorControlTransferOut(
        request: number,
        value: number,
        index: number,
        buffer: Buffer,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.device.controlTransfer(
                usb.LIBUSB_ENDPOINT_OUT | usb.LIBUSB_REQUEST_TYPE_VENDOR,
                request,
                value,
                index,
                buffer,
                (
                    error: LibUSBException | undefined,
                    _buffer: number | Buffer | undefined,
                ) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve();
                },
            );
        });
    }

    private async protocolQuery(): Promise<number> {
        const ACC_REQ_GET_PROTOCOL_VERSION = 51;
        const result = await this.vendorControlTransferIn(
            ACC_REQ_GET_PROTOCOL_VERSION,
            0,
            0,
            2,
        );

        return result.readUint16LE();
    }

    private async sendString(
        stringType: StringType,
        str: string,
    ): Promise<void> {
        const ACC_REQ_SEND_STRING = 52;

        const data = Buffer.alloc(str.length + 1);
        data.write(str);

        await this.vendorControlTransferOut(
            ACC_REQ_SEND_STRING,
            0,
            stringType,
            data,
        );
    }

    private async start(): Promise<void> {
        const ACC_REQ_START = 53;

        const data = Buffer.alloc(0);

        await this.vendorControlTransferOut(ACC_REQ_START, 0, 0, data);
    }

    private async checkAoap(): Promise<void> {
        const protocolVersion = await this.protocolQuery();
        if (protocolVersion !== 1 && protocolVersion !== 2) {
            throw new Error('Invalid AOAP protocol version');
        }
    }

    private async startAndroidAutoAoap(): Promise<void> {
        await this.sendString(StringType.MANUFACTURER, 'Android');
        await this.sendString(StringType.MODEL, 'Android Auto');
        await this.sendString(StringType.DESCRIPTION, 'Android Auto');
        await this.sendString(StringType.VERSION, '2.0.1');

        await this.start();
    }

    private async checkAndStartAndroidAutoAoap(): Promise<void> {
        this.logger.debug('Checking for AOAP support');
        try {
            await this.checkAoap();
        } catch (err) {
            this.logger.debug('AOAP not supported', err);
            throw err;
        }
        this.logger.debug('AOAP supported');

        this.logger.debug('Starting Android Auto AOAP');
        try {
            await this.startAndroidAutoAoap();
        } catch (err) {
            this.logger.error('Failed to start Android Auto AOAP');
            throw err;
        }
        this.logger.debug('Started Android Auto AOAP');
    }

    private findEndpoints(): void {
        const intf = this.device.interface(INTERFACE_INDEX);

        let inEndpoint: InEndpoint | undefined;
        let outEndpoint: OutEndpoint | undefined;

        const endpoints = intf.endpoints;
        for (const endpoint of endpoints) {
            if (endpoint.direction == 'in') {
                inEndpoint = endpoint as InEndpoint;
            }

            if (endpoint.direction == 'out') {
                outEndpoint = endpoint as OutEndpoint;
            }

            if (inEndpoint && outEndpoint) {
                break;
            }
        }

        if (inEndpoint === undefined) {
            throw new Error('Failed to find in endpoint');
        }

        if (outEndpoint === undefined) {
            throw new Error('Failed to find in endpoint');
        }

        this.inEndpoint = inEndpoint;
        this.outEndpoint = outEndpoint;
    }

    private isDeviceAoap(): boolean {
        return (
            this.vendorId === GOOGLE_VENDOR_ID &&
            GOOGLE_AOAP_IDS.includes(this.productId)
        );
    }

    public override async probe(existing?: true): Promise<void> {
        this.logger.debug('Probing');

        if (this.isDeviceAoap()) {
            if (existing) {
                this.setState(DeviceState.NEEDS_RESET);
            } else {
                this.setState(DeviceState.AVAILABLE);
            }
            return;
        }

        this.setState(DeviceState.UNSUPPORTED);

        try {
            this.open();
        } catch (e) {
            this.logger.error('Failed to open');
            return;
        }

        try {
            await this.checkAndStartAndroidAutoAoap();
        } catch (e) {
            try {
                this.close();
            } catch (e) {
                this.logger.error('Failed to close');
            }
        }
    }

    public open(): void {
        assert(!this.opened);
        this.device.open();
        this.opened = true;
    }

    private resetImpl(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.device.reset((error) => {
                if (error !== undefined) {
                    return reject(error);
                }

                resolve();
            });
        });
    }

    public override async reset(): Promise<void> {
        if (!this.opened) {
            this.open();
        }

        for (let i = 0; i < 100; i++) {
            try {
                this.logger.info(`Reset attempt ${i}`);
                await this.resetImpl();
            } catch (err) {
                const usbError = err as LibUSBException;
                if (usbError.errno === usb.LIBUSB_ERROR_NOT_FOUND) {
                    this.logger.info('Reset succeeded');
                    break;
                }
            }
        }
    }

    public close(): void {
        assert(this.opened);
        try {
            this.device.close();
        } catch (err) {
            // do nothing
        }
        this.opened = false;
    }

    private transferOut(buffer: Uint8Array): Promise<void> {
        const outEndpoint = this.outEndpoint;
        if (outEndpoint === undefined) {
            throw new Error('Out endpoint not open');
        }

        return new Promise((resolve, reject) => {
            assert(outEndpoint !== undefined);
            const transfer = outEndpoint.makeTransfer(
                1000,
                (error, _data, _length) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve();
                },
            );

            transfer.submit(bufferWrapUint8Array(buffer));
        });
    }

    private startPoll(): void {
        const inEndpoint = this.inEndpoint;
        if (inEndpoint === undefined) {
            throw new Error('In endpoint not open');
        }

        if (inEndpoint.pollActive) {
            return;
        }

        inEndpoint.startPoll(3, 16384);

        inEndpoint.on('data', this.onDataBound);

        inEndpoint.on('error', this.onErrorBound);

        inEndpoint.on('end', this.onDisconnectedBound);
    }

    private stopPoll(): void {
        const inEndpoint = this.inEndpoint;
        if (inEndpoint === undefined) {
            throw new Error('In endpoint not open');
        }

        if (!inEndpoint.pollActive) {
            return;
        }

        inEndpoint.off('data', this.onDataBound);

        inEndpoint.off('error', this.onErrorBound);

        inEndpoint.off('end', this.onDisconnectedBound);

        inEndpoint.stopPoll();
    }

    public claimInterface(index: number): void {
        this.device.interface(index).claim();
    }

    public async releaseInterface(index: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.device.interface(index).release(false, (error) => {
                if (error !== undefined) {
                    return reject(error);
                }

                resolve();
            });
        });
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async connectImpl(_reason: DeviceConnectReason): Promise<void> {
        this.open();
        this.claimInterface(INTERFACE_INDEX);
        this.findEndpoints();
        this.startPoll();
    }

    protected override async disconnectImpl(
        _reason: DeviceDisconnectReason,
    ): Promise<void> {
        this.stopPoll();

        await this.releaseInterface(INTERFACE_INDEX);
        await this.reset();
    }

    public override send(buffer: Uint8Array): Promise<void> {
        return this.transferOut(buffer);
    }
}
