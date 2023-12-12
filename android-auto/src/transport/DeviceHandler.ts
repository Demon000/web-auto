import { getLogger } from '@web-auto/logging';
import { DataBuffer } from '../index.js';
import { Device, type DeviceEvents } from './Device.js';

export interface DeviceHandlerEvents {
    onDeviceAvailable: (device: Device) => Promise<void>;
    onDeviceUnavailable: (device: Device) => Promise<void>;

    onDeviceSelfConnection: (device: Device) => Promise<void>;
    onDeviceSelfDisconnection: (
        device: Device,
        reason: string,
    ) => Promise<void>;

    onDeviceStateUpdated: (device: Device) => Promise<void>;

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
            onSelfConnection: this.events.onDeviceSelfConnection,
            onSelfDisconnection: this.events.onDeviceSelfDisconnection,
            onStateUpdated: this.events.onDeviceStateUpdated,
            onTransportData: this.events.onDeviceTransportData,
            onTransportError: this.events.onDeviceTransportError,
        };
    }

    public abstract waitForDevices(): Promise<void>;
    public async stopWaitingForDevices(): Promise<void> {}
}
