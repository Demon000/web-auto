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

    protected makeDeviceAvailable(ip: string): void {
        const device = new TcpDevice(ip, this.getDeviceEvents());
        try {
            this.events.onDeviceAvailable(device);
        } catch (err) {
            this.logger.error('Failed to emit device available event', err);
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async waitForDevices(): Promise<void> {
        for (const ip of this.config.ips) {
            this.makeDeviceAvailable(ip);
        }
    }
}
