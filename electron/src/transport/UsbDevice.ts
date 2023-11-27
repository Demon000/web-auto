import {
    Device,
    DeviceDisconnectReason,
    Transport,
} from '@web-auto/android-auto';
import { ElectronUsbDuplex } from './ElectronUsbDuplex';
import { ElectronDuplexTransport } from './ElectronDuplexTransport';

export const usbDeviceName = (device: USBDevice) => {
    let name;

    if (device.productName !== undefined) {
        name = device.productName;
    } else if (device.manufacturerName !== undefined) {
        name = device.manufacturerName;
    } else {
        name = `${device.vendorId}:${device.productId}`;
    }

    return name;
};

export class UsbDevice extends Device {
    public constructor(private device: USBDevice) {
        super('USB', usbDeviceName(device));
    }

    public async connectImpl(): Promise<Transport> {
        await this.device.open();

        const duplex = new ElectronUsbDuplex(this.device);
        const transport = new ElectronDuplexTransport(duplex);

        return transport;
    }

    protected async handleDisconnect(reason: string): Promise<void> {
        switch (reason) {
            case DeviceDisconnectReason.USER:
                await this.device.reset();
        }
    }
}
