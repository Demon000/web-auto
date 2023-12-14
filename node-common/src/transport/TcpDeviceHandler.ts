import {
    DeviceHandler,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import { TcpDevice } from './TcpDevice.js';

export interface TcpDeviceHandlerConfig {
    ips: string[];
}

export class TcpDeviceHandler extends DeviceHandler {
    public constructor(
        private config: TcpDeviceHandlerConfig,
        events: DeviceHandlerEvents,
    ) {
        super(events);
    }

    protected async makeDeviceAvailable(ip: string): Promise<void> {
        const device = new TcpDevice(ip, this.getDeviceEvents());
        try {
            await this.events.onDeviceAvailable(device);
        } catch (err) {
            this.logger.error('Failed to emit device available event', err);
        }
    }

    public async waitForDevices(): Promise<void> {
        for (const ip of this.config.ips) {
            await this.makeDeviceAvailable(ip);
        }
    }
}
