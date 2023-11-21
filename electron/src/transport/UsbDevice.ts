import { Device, DeviceState } from '@web-auto/android-auto';
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

    public async connect(): Promise<void> {
        if (this.state !== DeviceState.AVAILABLE) {
            return;
        }

        await this.device.open();

        const duplex = new ElectronUsbDuplex(this.device);
        const transport = new ElectronDuplexTransport(duplex);

        this.handleConnect(transport);
    }
}
