import { DeviceHandler, DeviceHandlerEvent } from '@web-auto/android-auto';
import { getLogger } from '@web-auto/logging';
import { TcpDevice } from './TcpDevice';

export interface ElectronTcpDeviceHandlerConfig {
    ips: string[];
}

export class ElectronTcpDeviceHandler extends DeviceHandler {
    protected logger = getLogger(this.constructor.name);

    public constructor(private config: ElectronTcpDeviceHandlerConfig) {
        super();
    }

    protected makeDeviceAvailable(ip: string): void {
        const device = new TcpDevice(ip);
        this.emitter.emit(DeviceHandlerEvent.AVAILABLE, device);
    }

    public waitForDevices(): void {
        for (const ip of this.config.ips) {
            this.makeDeviceAvailable(ip);
        }
    }

    public stopWaitingForDevices(): void {}
}
