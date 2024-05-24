import { getLogger } from '@web-auto/logging';
import type { Device } from './Device.js';

export interface DeviceIndexEvents {
    onDeviceAdded: (device: Device) => void;
    onDeviceRemoved: (device: Device) => void;
}

export class DeviceIndex {
    protected logger = getLogger(this.constructor.name);

    protected map = new Map<string, Device>();

    public constructor(private events: DeviceIndexEvents) {}

    public hasDeviceId(uniqueId: string): boolean {
        return this.map.has(uniqueId);
    }

    public getDeviceIds(): Iterable<string> {
        return this.map.keys();
    }

    public addDevice(device: Device): void {
        if (this.map.has(device.uniqueId)) {
            throw new Error(`Device with id ${device.uniqueId} already exists`);
        }

        this.map.set(device.uniqueId, device);

        try {
            this.events.onDeviceAdded(device);
        } catch (err) {
            this.logger.error('Failed to emit device added event', err);
        }
    }

    public findDevice(uniqueId: string): Device | undefined {
        return this.map.get(uniqueId);
    }

    public removeDevice(device: Device): void {
        if (!this.map.has(device.uniqueId)) {
            throw new Error(`Device with id ${device.uniqueId} does not exist`);
        }

        this.map.delete(device.uniqueId);

        try {
            this.events.onDeviceRemoved(device);
        } catch (err) {
            this.logger.error('Failed to emit device removed event', err);
        }
    }
}
