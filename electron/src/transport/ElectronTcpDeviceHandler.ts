import { DeviceHandler, DeviceHandlerEvent } from '@web-auto/android-auto';
import { TcpDevice } from './TcpDevice';

export interface ElectronTcpDeviceHandlerConfig {
    ips: string[];
}

export class ElectronTcpDeviceHandler extends DeviceHandler {
    public constructor(private config: ElectronTcpDeviceHandlerConfig) {
        super();
    }

    protected makeDeviceAvailable(ip: string): void {
        const device = new TcpDevice(ip);
        this.emitter.emit(DeviceHandlerEvent.AVAILABLE, device);
    }

    public async waitForDevices(): Promise<void> {
        for (const ip of this.config.ips) {
            this.makeDeviceAvailable(ip);
        }
    }
}
