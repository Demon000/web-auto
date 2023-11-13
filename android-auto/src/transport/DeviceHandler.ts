import EventEmitter from 'eventemitter3';
import { Transport } from './Transport';

export enum DeviceHandlerEvent {
    AVAILABLE,
}

export interface DeviceHandlerEvents {
    [DeviceHandlerEvent.AVAILABLE]: (transport: Transport) => void;
}

export abstract class DeviceHandler {
    public emitter = new EventEmitter<DeviceHandlerEvents>();

    public abstract waitForDevices(): void;
    public abstract stopWaitingForDevices(): void;
}
