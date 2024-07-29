import { getLogger } from '@web-auto/logging';
import { Mutex } from 'async-mutex';

import {
    Device,
    DeviceCreateIgnoredError,
    type DeviceDisconnectReason,
    type DeviceEvents,
    DeviceState,
} from './Device.js';

export interface DeviceHandlerEvents {
    onDeviceAdded: (device: Device) => void;
    onDeviceRemoved: (device: Device) => void;

    onDeviceSelfConnection: (device: Device) => void;
    onDeviceSelfDisconnection: (
        device: Device,
        reason: DeviceDisconnectReason,
    ) => void;

    onDeviceStateUpdated: (device: Device) => void;

    onDeviceTransportData: (device: Device, buffer: Uint8Array) => void;
    onDeviceTransportError: (device: Device, err: Error) => void;
}

export interface DeviceHandlerConfig {
    ignoredDevices: string[] | undefined;
}

export abstract class DeviceHandler<T = any> {
    protected logger = getLogger(this.constructor.name);
    protected deviceMap = new Map<string, Device>();
    private deviceMapLock = new Mutex();
    protected addDeviceBound: (data: T) => void;
    protected removeDeviceBound: (uniqueId: string) => void;

    public constructor(
        protected config: DeviceHandlerConfig,
        protected events: DeviceHandlerEvents,
    ) {
        this.addDeviceBound = this.addDevice.bind(this);
        this.removeDeviceBound = this.removeDevice.bind(this);
    }

    protected isIgnoredDevice(device: Device): boolean {
        if (this.config.ignoredDevices === undefined) {
            return false;
        }

        for (const ignoredDevice of this.config.ignoredDevices) {
            if (ignoredDevice == device.realName) {
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
            if (err instanceof DeviceCreateIgnoredError) {
                this.logger.info(
                    `Ignored device with data: ${err.message}`,
                    data,
                );
                return;
            }

            this.logger.error('Failed to create device with data', {
                data,
                err,
            });
            return;
        }

        if (device === undefined) {
            return;
        }

        if (this.isIgnoredDevice(device)) {
            this.logger.info(`Device ${device.name} ignored`);
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

        this.deviceMap.set(device.uniqueId, device);
        this.addDeviceHook(data, device);

        try {
            this.events.onDeviceAdded(device);
        } catch (err) {
            this.logger.error('Failed to emit device added event', err);
        }
    }

    protected async addDeviceAsync(data: T, existing?: true): Promise<void> {
        const release = await this.deviceMapLock.acquire();
        try {
            await this.addDeviceAsyncLocked(data, existing);
        } finally {
            release();
        }
    }

    protected removeDeviceLocked(uniqueId: string): void {
        const device = this.deviceMap.get(uniqueId);
        if (device === undefined) {
            return;
        }

        this.deviceMap.delete(device.uniqueId);
        this.removeDeviceHook(device);

        try {
            this.events.onDeviceRemoved(device);
        } catch (err) {
            this.logger.error('Failed to emit device removed event', err);
        }
    }

    protected async removeDeviceAsync(uniqueId: string): Promise<void> {
        const release = await this.deviceMapLock.acquire();
        try {
            this.removeDeviceLocked(uniqueId);
        } finally {
            release();
        }
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
