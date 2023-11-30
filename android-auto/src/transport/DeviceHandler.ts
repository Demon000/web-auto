import { getLogger } from '@web-auto/logging';
import { DataBuffer } from '..';
import { Device, DeviceEvents } from './Device';

export interface DeviceHandlerEvents {
    onDeviceAvailable: (device: Device) => Promise<void>;
    onDeviceUnavailable: (device: Device) => Promise<void>;

    onDeviceStateUpdated: (device: Device) => Promise<void>;
    onDeviceSelfConnect: (device: Device) => Promise<boolean>;
    onDeviceConnected: (device: Device) => Promise<void>;
    onDeviceDisconnect: (device: Device) => Promise<void>;
    onDeviceDisconnected: (device: Device) => Promise<void>;

    onDeviceTransportData: (
        device: Device,
        buffer: DataBuffer,
    ) => Promise<void>;
    onDeviceTransportError: (device: Device, err: Error) => Promise<void>;
}

export abstract class DeviceHandler {
    protected logger = getLogger(this.constructor.name);

    public constructor(protected events: DeviceHandlerEvents) {}

    protected getDeviceEvents(): DeviceEvents {
        return {
            onStateUpdated: this.events.onDeviceStateUpdated,
            onSelfConnect: this.events.onDeviceSelfConnect,
            onConnected: this.events.onDeviceConnected,
            onDisconnect: this.events.onDeviceDisconnect,
            onDisconnected: this.events.onDeviceDisconnected,
            onTransportData: this.events.onDeviceTransportData,
            onTransportError: this.events.onDeviceTransportError,
        };
    }

    public abstract waitForDevices(): Promise<void>;
    public async stopWaitingForDevices(): Promise<void> {}
}
