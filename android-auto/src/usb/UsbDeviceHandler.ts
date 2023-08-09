import EventEmitter from 'eventemitter3';
import { Device, LibUSBException, usb } from 'usb';

enum StringType {
    MANUFACTURER,
    MODEL,
    DESCRIPTION,
    VERSION,
    URI,
    SERIAL,
}

export enum UsbDeviceHandlerEvent {
    CONNECTED,
    DISCONNECTED,
}

export interface UsbDeviceHandlerEvents {
    [UsbDeviceHandlerEvent.CONNECTED]: (device: Device) => void;
    [UsbDeviceHandlerEvent.DISCONNECTED]: (device: Device) => void;
}

export class UsbDeviceHandler {
    public emitter = new EventEmitter<UsbDeviceHandlerEvents>();
    private androidAutoDevices: Device[] = [];
    public constructor() {
        this.handleConnectedDevice = this.handleConnectedDevice.bind(this);
        this.handleDisconnectedDevice =
            this.handleDisconnectedDevice.bind(this);
    }

    private async controlTransfer(
        device: Device,
        bmRequestType: number,
        bRequest: number,
        wValue: number,
        wIndex: number,
        dataOrLength: number | Buffer,
    ): Promise<Buffer | number | undefined> {
        return new Promise((resolve, reject) => {
            device.controlTransfer(
                bmRequestType,
                bRequest,
                wValue,
                wIndex,
                dataOrLength,
                (
                    error: LibUSBException | undefined,
                    buffer: number | Buffer | undefined,
                ) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve(buffer);
                },
            );
        });
    }

    private async startProtocolQuery(device: Device): Promise<number> {
        const ACC_REQ_GET_PROTOCOL_VERSION = 51;
        const buffer = (await this.controlTransfer(
            device,
            usb.LIBUSB_ENDPOINT_IN | usb.LIBUSB_REQUEST_TYPE_VENDOR,
            ACC_REQ_GET_PROTOCOL_VERSION,
            0,
            0,
            2,
        )) as Buffer;
        return buffer.readUint16LE();
    }

    private async startSendStringQuery(
        device: Device,
        stringType: StringType,
        str: string,
    ): Promise<void> {
        const ACC_REQ_SEND_STRING = 52;
        const data = Buffer.alloc(str.length + 1);
        data.write(str);
        await this.controlTransfer(
            device,
            usb.LIBUSB_ENDPOINT_OUT | usb.LIBUSB_REQUEST_TYPE_VENDOR,
            ACC_REQ_SEND_STRING,
            0,
            stringType,
            data,
        );
    }

    private async startStartQuery(device: Device): Promise<void> {
        /* Library throws error if buffer is not passed when specifying out endpoint. */
        const ACC_REQ_START = 53;
        const data = Buffer.from('');
        await this.controlTransfer(
            device,
            usb.LIBUSB_ENDPOINT_OUT | usb.LIBUSB_REQUEST_TYPE_VENDOR,
            ACC_REQ_START,
            0,
            0,
            data,
        );
    }

    private isUsbDeviceAndroidAuto(device: Device): boolean {
        const deviceDescriptor = device.deviceDescriptor;
        const googleVendorId = 0x18d1;
        const aoapId = 0x2d00;
        const aoapWithAdbId = 0x2d01;

        return (
            deviceDescriptor.idVendor === googleVendorId &&
            (deviceDescriptor.idProduct === aoapId ||
                deviceDescriptor.idProduct === aoapWithAdbId)
        );
    }

    private async swithUsbDeviceToAndroidAuto(device: Device): Promise<void> {
        const protocolVersion = await this.startProtocolQuery(device);
        if (protocolVersion !== 1 && protocolVersion !== 2) {
            return;
        }

        await this.startSendStringQuery(
            device,
            StringType.MANUFACTURER,
            'Android',
        );
        await this.startSendStringQuery(
            device,
            StringType.MODEL,
            'Android Auto',
        );
        await this.startSendStringQuery(
            device,
            StringType.DESCRIPTION,
            'Android Auto',
        );
        await this.startSendStringQuery(device, StringType.VERSION, '2.0.1');
        // await startSendStringQuery(device, StringType.URI, "https://f1xstudio.com");
        // await startSendStringQuery(device, StringType.SERIAL, "HU-AAAAAA001");
        await this.startStartQuery(device);
    }

    private getStringDescriptor(device: Device, id: number): Promise<string> {
        return new Promise((resolve) =>
            device.getStringDescriptor(id, (error, text) => {
                if (error || text === undefined) {
                    text = '';
                }

                resolve(text);
            }),
        );
    }

    private async handleConnectedDevice(device: Device): Promise<void> {
        device.open();

        const deviceDescriptor = device.deviceDescriptor;
        const manufacturer = await this.getStringDescriptor(
            device,
            deviceDescriptor.iManufacturer,
        );
        const deviceName = await this.getStringDescriptor(
            device,
            deviceDescriptor.iProduct,
        );

        if (this.isUsbDeviceAndroidAuto(device)) {
            console.log(
                `Found device ${manufacturer} ${deviceName} with Android Auto`,
            );
            this.androidAutoDevices.push(device);
            this.emitter.emit(UsbDeviceHandlerEvent.CONNECTED, device);
            return;
        }

        let supported;
        try {
            await this.swithUsbDeviceToAndroidAuto(device);
            supported = true;
        } catch (e) {
            supported = false;
        }

        if (supported) {
            console.log(`Found device ${manufacturer} ${deviceName} with AOAP`);
        } else {
            console.log(
                `Found device ${manufacturer} ${deviceName} without AOAP`,
            );
            device.close();
        }
    }

    private handleDisconnectedDevice(device: Device): void {
        this.emitter.emit(UsbDeviceHandlerEvent.DISCONNECTED, device);
    }

    public async waitForDevices(): Promise<void> {
        const devices = usb.getDeviceList();

        usb.on('attach', this.handleConnectedDevice);
        usb.on('detach', this.handleDisconnectedDevice);

        for (const device of devices) {
            await this.handleConnectedDevice(device);
        }
    }

    public stopWaitingForDevices(): void {
        usb.removeListener('attach', this.handleConnectedDevice);
        usb.removeListener('detach', this.handleDisconnectedDevice);
    }

    public disconnectDevices(): void {
        for (const device of this.androidAutoDevices) {
            this.handleDisconnectedDevice(device);
            device.close();
        }
    }
}
