import {
    Device,
    DeviceDisconnectReason,
    type DeviceEvents,
    Transport,
    type TransportEvents,
} from '@web-auto/android-auto';
import type { UsbDeviceWrapper } from './UsbDeviceWrapper.js';
import { UsbTransport } from './UsbTransport.js';

export class UsbDevice extends Device {
    public constructor(
        private device: UsbDeviceWrapper,
        events: DeviceEvents,
    ) {
        super('USB', device.name, events);
    }

    public async connectImpl(events: TransportEvents): Promise<Transport> {
        await this.device.open();

        return new UsbTransport(this.device, events);
    }

    protected override async handleDisconnect(reason: string): Promise<void> {
        switch (reason as DeviceDisconnectReason) {
            case DeviceDisconnectReason.USER:
                await this.device.reset();
        }
    }
}
