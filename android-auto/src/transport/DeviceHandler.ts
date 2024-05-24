import { getLogger } from '@web-auto/logging';
import {
    Device,
    DeviceState,
    type DeviceDisconnectReason,
    type DeviceEvents,
} from './Device.js';
import { Mutex } from 'async-mutex';
import type { DeviceIndex } from './DeviceIndex.js';

export interface DeviceHandlerEvents {
    onDeviceSelfConnection: (device: Device) => void;
    onDeviceSelfDisconnection: (
        device: Device,
        reason: DeviceDisconnectReason,
    ) => void;

    onDeviceStateUpdated: (device: Device) => void;

    onDeviceTransportData: (device: Device, buffer: Uint8Array) => void;
    onDeviceTransportError: (device: Device, err: Error) => void;
}

export interface DeviceHandlerParams {
    ignoredDevices: string[] | undefined;
}

export abstract class DeviceHandler<T = any> {
    protected logger = getLogger(this.constructor.name);
    private deviceMapLock = new Mutex();
    protected addDeviceBound: (data: T) => void;
    protected removeDeviceBound: (uniqueId: string) => void;

    public constructor(
        protected params: DeviceHandlerParams,
        protected index: DeviceIndex,
        protected events: DeviceHandlerEvents,
    ) {
        this.addDeviceBound = this.addDevice.bind(this);
        this.removeDeviceBound = this.removeDevice.bind(this);
    }

    protected isIgnoredDevice(device: Device): boolean {
        if (this.params.ignoredDevices === undefined) {
            return false;
        }

        for (const ignoredDevice of this.params.ignoredDevices) {
            if (ignoredDevice == device.name) {
                return true;
            }
        }

        return false;
    }

    protected abstract createDevice(data: T): Promise<Device | undefined>;
    protected addDeviceHook(_data: T, _device: Device): void {}
    protected removeDeviceHook(_device: Device) {}

    protected async addDeviceAsyncLocked(
        data: T,
        existing?: true,
    ): Promise<void> {
        let device;

        try {
            device = await this.createDevice(data);
        } catch (err) {
            this.logger.error('Failed to create device with data', {
                data,
                err,
            });
            return;
        }

        if (device === undefined || this.isIgnoredDevice(device)) {
            return;
        }

        try {
            await device.probe(existing);
        } catch (err) {
            this.logger.error('Failed to probe device', {
                device,
                err,
            });
            return;
        }

        if (device.state === DeviceState.NEEDS_RESET) {
            try {
                await device.reset();
            } catch (err) {
                this.logger.error('Failed to reset device', {
                    device,
                    err,
                });
            }
        }

        this.addDeviceHook(data, device);
        this.index.addDevice(device);
    }

    protected async addDeviceAsync(data: T, existing?: true): Promise<void> {
        const release = await this.deviceMapLock.acquire();
        await this.addDeviceAsyncLocked(data, existing);
        release();
    }

    protected removeDeviceLocked(uniqueId: string): void {
        const device = this.index.findDevice(uniqueId);
        if (device === undefined) {
            return;
        }

        this.index.removeDevice(device);
        this.removeDeviceHook(device);
    }

    protected async removeDeviceAsync(uniqueId: string): Promise<void> {
        const release = await this.deviceMapLock.acquire();
        this.removeDeviceLocked(uniqueId);
        release();
    }

    protected async updateDevicesAsync(map: Map<string, T>): Promise<void> {
        const release = await this.deviceMapLock.acquire();

        for (const uniqueId of this.index.getDeviceIds()) {
            if (!map.has(uniqueId)) {
                this.removeDeviceLocked(uniqueId);
            }
        }

        for (const [uniqueId, data] of map.entries()) {
            if (!this.index.hasDeviceId(uniqueId)) {
                await this.addDeviceAsyncLocked(data);
            }
        }

        release();
    }

    protected updateDevices(map: Map<string, T>): void {
        this.updateDevicesAsync(map)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to handle devices update', err);
            });
    }

    protected addDevice(data: T): void {
        this.addDeviceAsync(data)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to handle device add', err);
            });
    }

    protected removeDevice(uniqueId: string): void {
        this.removeDeviceAsync(uniqueId)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to handle device remove', err);
            });
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
