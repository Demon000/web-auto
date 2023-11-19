import EventEmitter from 'eventemitter3';
import { Device } from './Device';

export enum DeviceHandlerEvent {
    AVAILABLE = 'available',
    UNAVAILABLE = 'unavailable',
}

export interface DeviceHandlerEvents {
    [DeviceHandlerEvent.AVAILABLE]: (device: Device) => void;
    [DeviceHandlerEvent.UNAVAILABLE]: (device: Device) => void;
}

export abstract class DeviceHandler {
    public emitter = new EventEmitter<DeviceHandlerEvents>();

    public abstract waitForDevices(): void;
    public abstract stopWaitingForDevices(): void;
}
