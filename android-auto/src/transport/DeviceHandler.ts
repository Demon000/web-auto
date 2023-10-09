import EventEmitter from 'eventemitter3';
import { Transport } from './Transport';

export enum DeviceHandlerEvent {
    CONNECTED,
    DISCONNECTED,
}

export interface DeviceHandlerEvents {
    [DeviceHandlerEvent.CONNECTED]: (transport: Transport) => void;
    [DeviceHandlerEvent.DISCONNECTED]: (transport: Transport) => void;
}

export abstract class DeviceHandler {
    public emitter = new EventEmitter<DeviceHandlerEvents>();

    public abstract waitForDevices(): void;
    public abstract stopWaitingForDevices(): void;
    public abstract disconnectDevices(): void;
    public stop(): void {
        this.emitter.removeAllListeners();
    }
}
