import {
    Device,
    DeviceDisconnectReason,
    type DeviceEvents,
    Transport,
    type TransportEvents,
} from '@web-auto/android-auto';
import { UsbDuplex } from './UsbDuplex.js';
import { DuplexTransport } from './DuplexTransport.js';

export const usbDeviceName = (device: USBDevice) => {
    let name;

    if (device.productName !== undefined && device.productName.length !== 0) {
        name = device.productName;
    } else if (
        device.manufacturerName !== undefined &&
        device.manufacturerName.length !== 0
    ) {
        name = device.manufacturerName;
    } else {
        const toHex = (n: number) => n.toString(16).padStart(4, '0');
        name = `${toHex(device.vendorId)}:${toHex(device.productId)}`;
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

        const duplex = new UsbDuplex(this.device);
        await duplex.claimInterface();
        const transport = new DuplexTransport(duplex, events);

        return transport;
    }

    protected override async handleDisconnect(reason: string): Promise<void> {
        switch (reason as DeviceDisconnectReason) {
            case DeviceDisconnectReason.USER:
                await this.device.reset();
        }
    }
}
