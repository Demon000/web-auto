import {
    Device,
    DeviceDisconnectReason,
    type DeviceEvents,
    Transport,
    type TransportEvents,
} from '@web-auto/android-auto';
import { UsbDuplex } from './UsbDuplex.js';
import { DuplexTransport } from '../DuplexTransport.js';
import type { UsbDeviceWrapper } from './UsbDeviceWrapper.js';

export class UsbDevice extends Device {
    public constructor(
        private device: UsbDeviceWrapper,
        events: DeviceEvents,
    ) {
        super('USB', device.name, events);
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
