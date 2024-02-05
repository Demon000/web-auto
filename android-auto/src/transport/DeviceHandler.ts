import { getLogger } from '@web-auto/logging';
import { Device, type DeviceEvents } from './Device.js';
import { Mutex } from 'async-mutex';

export interface DeviceHandlerEvents {
    onDeviceAvailable: (device: Device) => void;
    onDeviceUnavailable: (device: Device) => void;

    onDeviceSelfConnection: (device: Device) => void;
    onDeviceSelfDisconnection: (device: Device, reason?: string) => void;

    onDeviceStateUpdated: (device: Device) => void;

    onDeviceTransportData: (device: Device, buffer: Uint8Array) => void;
    onDeviceTransportError: (device: Device, err: Error) => void;
}

export abstract class DeviceHandler<T = any> {
    protected logger = getLogger(this.constructor.name);
    protected deviceMap = new Map<T, Device>();
    private deviceMapLock = new Mutex();
    protected addDeviceBound: (data: T) => void;
    protected removeDeviceBound: (data: T) => void;

    public constructor(
        protected ignoredDevices: string[],
        protected events: DeviceHandlerEvents,
    ) {
        this.addDeviceBound = this.addDevice.bind(this);
        this.removeDeviceBound = this.removeDevice.bind(this);
    }

    protected isIgnoredDevice(device: Device): boolean {
        if (this.ignoredDevices === undefined) {
            return false;
        }

        for (const ignoredDevice of this.ignoredDevices) {
            if (ignoredDevice == device.name) {
                return true;
            }
        }

        return false;
    }

    protected abstract createDevice(data: T): Promise<Device | undefined>;
    protected destroyDevice(_data: T, _device: Device): void {}

    protected async addDeviceAsyncLocked(data: T): Promise<void> {
        let device;

        try {
            device = await this.createDevice(data);
            if (device === undefined || this.isIgnoredDevice(device)) {
                return;
            }

            const probed = await device.probe();
            if (!probed) {
                return;
            }
        } catch (err) {
            this.logger.error('Failed to create device', {
                device,
                err,
            });
            return;
        }

        this.deviceMap.set(data, device);
        this.events.onDeviceAvailable(device);
    }

    protected async addDeviceAsync(data: T): Promise<void> {
        const release = await this.deviceMapLock.acquire();
        await this.addDeviceAsyncLocked(data);
        release();
    }

    protected addDevice(data: T): void {
        this.addDeviceAsync(data)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to handle device add', err);
            });
    }

    protected removeDevice(data: T): void {
        this.removeDeviceAsync(data)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to handle device remove', err);
            });
    }

    protected removeDeviceLocked(data: T): void {
        const device = this.deviceMap.get(data);
        if (device === undefined) {
            return;
        }

        this.destroyDevice(data, device);
        this.deviceMap.delete(data);
        try {
            this.events.onDeviceUnavailable(device);
        } catch (err) {
            this.logger.error('Failed to emit device unavailable event', err);
        }
    }

    protected async removeDeviceAsync(data: T): Promise<void> {
        const release = await this.deviceMapLock.acquire();
        this.removeDeviceLocked(data);
        release();
    }

    protected getDeviceEvents(): DeviceEvents {
        return {
            onSelfConnection: this.events.onDeviceSelfConnection,
            onSelfDisconnection: this.events.onDeviceSelfDisconnection,
            onStateUpdated: this.events.onDeviceStateUpdated,
            onData: this.events.onDeviceTransportData,
            onError: this.events.onDeviceTransportError,
        };
    }

    public abstract waitForDevices(): Promise<void>;
    public async stopWaitingForDevices(): Promise<void> {}
}
