import EventEmitter from 'eventemitter3';
import { ITransport } from './ITransport';

export enum DeviceHandlerEvent {
    CONNECTED,
    DISCONNECTED,
}

export interface DeviceHandlerEvents {
    [DeviceHandlerEvent.CONNECTED]: (transport: ITransport) => void;
    [DeviceHandlerEvent.DISCONNECTED]: (transport: ITransport) => void;
}

export abstract class DeviceHandler {
    public emitter = new EventEmitter<DeviceHandlerEvents>();

    public abstract waitForDevices(): void;
    public abstract stopWaitingForDevices(): void;
    public abstract disconnectDevices(): void;
}
