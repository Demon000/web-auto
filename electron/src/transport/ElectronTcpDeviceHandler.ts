import { DeviceHandler, DeviceHandlerEvents } from '@web-auto/android-auto';
import { TcpDevice } from './TcpDevice';

export interface ElectronTcpDeviceHandlerConfig {
    ips: string[];
}

export class ElectronTcpDeviceHandler extends DeviceHandler {
    public constructor(
        private config: ElectronTcpDeviceHandlerConfig,
        events: DeviceHandlerEvents,
    ) {
        super(events);
    }

    protected async makeDeviceAvailable(ip: string): Promise<void> {
        const device = new TcpDevice(ip, this.getDeviceEvents());
        try {
            await this.events.onDeviceAvailable(device);
        } catch (err) {
            this.logger.error('Failed to emit device available event', {
                metadata: err,
            });
        }
    }

    public async waitForDevices(): Promise<void> {
        for (const ip of this.config.ips) {
            await this.makeDeviceAvailable(ip);
        }
    }
}
