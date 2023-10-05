import { DeviceHandler, DeviceHandlerEvent } from '@web-auto/android-auto';
import { WebUSB } from 'usb';
import { ElectronUsbTransport } from './ElectronUsbTransport';
import { getLogger } from '@web-auto/logging';

enum StringType {
    MANUFACTURER,
    MODEL,
    DESCRIPTION,
    VERSION,
    URI,
    SERIAL,
}

const GOOGLE_VENDOR_ID = 0x18d1;
const GOOGLE_AOAP_WITHOUT_ADB_ID = 0x2d00;
const GOOGLE_AOAP_WITH_ADB_ID = 0x2d01;

export class ElectronUsbDeviceHandler extends DeviceHandler {
    private logger = getLogger(this.constructor.name);

    private deviceTransportMap = new Map<USBDevice, ElectronUsbTransport>();
    private usb;

    public constructor() {
        super();

        this.handleConnectedDevice = this.handleConnectedDevice.bind(this);
        this.handleDisconnectedDevice =
            this.handleDisconnectedDevice.bind(this);
        this.usb = new WebUSB({
            allowAllDevices: true,
        });
    }

    private isDeviceAoap(device: USBDevice): boolean {
        return (
            device.vendorId === GOOGLE_VENDOR_ID &&
            (device.productId === GOOGLE_AOAP_WITH_ADB_ID ||
                device.productId === GOOGLE_AOAP_WITHOUT_ADB_ID)
        );
    }

    private async protocolQuery(device: USBDevice): Promise<number> {
        const ACC_REQ_GET_PROTOCOL_VERSION = 51;
        const result = await device.controlTransferIn(
            {
                requestType: 'vendor',
                recipient: 'device',
                request: ACC_REQ_GET_PROTOCOL_VERSION,
                value: 0,
                index: 0,
            },
            2,
        );

        if (result.data === undefined) {
            throw new Error('Invalid data');
        } else if (result.status !== 'ok') {
            throw new Error('Invalid status');
        }

        return result.data.getUint16(0, true);
    }

    private async sendString(
        device: USBDevice,
        stringType: StringType,
        str: string,
    ): Promise<void> {
        const ACC_REQ_SEND_STRING = 52;

        const data = Buffer.alloc(str.length + 1);
        data.write(str);

        const result = await device.controlTransferOut(
            {
                requestType: 'vendor',
                recipient: 'device',
                request: ACC_REQ_SEND_STRING,
                value: 0,
                index: stringType,
            },
            data,
        );

        if (result.status !== 'ok') {
            throw new Error('Invalid status');
        }
    }

    private async start(device: USBDevice): Promise<void> {
        const ACC_REQ_START = 53;

        const result = await device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'device',
            request: ACC_REQ_START,
            value: 0,
            index: 0,
        });

        if (result.status !== 'ok') {
            throw new Error('Invalid status');
        }
    }

    private async checkUsbDeviceSupportsAoap(device: USBDevice): Promise<void> {
        const protocolVersion = await this.protocolQuery(device);
        if (protocolVersion !== 1 && protocolVersion !== 2) {
            throw new Error('Invalid AOAP protocol version');
        }
    }

    private async startAndroidAutoAoap(device: USBDevice): Promise<void> {
        await this.sendString(device, StringType.MANUFACTURER, 'Android');
        await this.sendString(device, StringType.MODEL, 'Android Auto');
        await this.sendString(device, StringType.DESCRIPTION, 'Android Auto');
        await this.sendString(device, StringType.VERSION, '2.0.1');

        await this.start(device);
    }

    private async handleConnectedAoapDevice(device: USBDevice): Promise<void> {
        this.logger.error(`Found device ${device.productName} with AA`);

        try {
            await device.open();
        } catch (e) {
            this.logger.error(`Failed to open device ${device.productName}`);
            return;
        }

        const transport = new ElectronUsbTransport(device);
        this.deviceTransportMap.set(device, transport);
        this.emitter.emit(DeviceHandlerEvent.CONNECTED, transport);
    }

    private async handleConnectedUnknownDevice(
        device: USBDevice,
    ): Promise<void> {
        try {
            await device.open();
        } catch (e) {
            this.logger.error(`Failed to open device ${device.productName}`);
            return;
        }

        try {
            await this.checkUsbDeviceSupportsAoap(device);
        } catch (e) {
            this.logger.debug(
                `Found device ${device.productName} without AOAP`,
            );

            try {
                await device.close();
            } catch (e) {
                this.logger.error(
                    `Failed to close device ${device.productName}`,
                );
                return;
            }
            return;
        }

        this.logger.info(`Found device ${device.productName} with AOAP`);

        try {
            await this.startAndroidAutoAoap(device);
        } catch (e) {
            this.logger.error(
                `Failed to start AA on device ${device.productName}`,
            );

            try {
                await device.close();
            } catch (e) {
                this.logger.error(
                    `Failed to close device ${device.productName}`,
                );
                return;
            }
        }
    }

    private async handleDisconnectedAoapDevice(
        device: USBDevice,
    ): Promise<void> {
        const transport = this.deviceTransportMap.get(device);
        if (transport === undefined) {
            return;
        }

        this.emitter.emit(DeviceHandlerEvent.DISCONNECTED, transport);
    }

    private async handleConnectedDevice(
        event: USBConnectionEvent,
    ): Promise<void> {
        const device = event.device;
        if (this.isDeviceAoap(device)) {
            this.handleConnectedAoapDevice(device);
        } else {
            this.handleConnectedUnknownDevice(device);
        }
    }

    private async handleDisconnectedDevice(
        event: USBConnectionEvent,
    ): Promise<void> {
        const device = event.device;
        if (!this.isDeviceAoap(device)) {
            return;
        }

        this.handleDisconnectedAoapDevice(device);
    }

    private async waitForDevicesAsync(): Promise<void> {
        this.usb.addEventListener('connect', this.handleConnectedDevice);
        this.usb.addEventListener('disconnect', this.handleDisconnectedDevice);

        const aoapDevices = await this.usb.getDevices();
        for (const device of aoapDevices) {
            if (!this.isDeviceAoap(device)) {
                await this.handleConnectedUnknownDevice(device);
            }
        }
    }

    public waitForDevices(): void {
        this.waitForDevicesAsync();
    }

    public stopWaitingForDevices(): void {
        this.usb.removeEventListener('connect', this.handleConnectedDevice);
        this.usb.removeEventListener(
            'disconnect',
            this.handleDisconnectedDevice,
        );
    }

    public disconnectDevices(): void {
        for (const device of this.deviceTransportMap.keys()) {
            this.handleDisconnectedAoapDevice(device);
        }
    }

    public stop(): void {
        this.emitter.removeAllListeners();
    }
}
