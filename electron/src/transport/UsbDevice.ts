import {
    Device,
    DeviceDisconnectReason,
    DeviceEvents,
    Transport,
    TransportEvents,
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
    public constructor(
        private device: USBDevice,
        events: DeviceEvents,
    ) {
        super('USB', usbDeviceName(device), events);
    }

    public async connectImpl(events: TransportEvents): Promise<Transport> {
        await this.device.open();

        const duplex = new ElectronUsbDuplex(this.device);
        const transport = new ElectronDuplexTransport(duplex, events);

        return transport;
    }

    protected async handleDisconnect(reason: string): Promise<void> {
        switch (reason) {
            case DeviceDisconnectReason.USER:
                await this.device.reset();
        }
    }
}
