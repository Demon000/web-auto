import EventEmitter from 'eventemitter3';
import { Transport, TransportEvent } from './Transport';
import assert from 'node:assert';

export enum DeviceEvent {
    CONNECTED,
    DISCONNECTED,
}

export enum DeviceState {
    AVAILABLE,
    CONNECTED,
    DISCONNECTED,
}

export interface DeviceEvents {
    [DeviceEvent.CONNECTED]: () => void;
    [DeviceEvent.DISCONNECTED]: () => void;
}

export abstract class Device {
    public emitter = new EventEmitter<DeviceEvents>();
    public transport?: Transport;
    public state = DeviceState.AVAILABLE;

    public constructor(public name: string) {}

    public async handleConnect(transport: Transport): Promise<void> {
        this.transport = transport;

        transport.emitter.once(TransportEvent.DISCONNECTED, () => {
            this.emitter.emit(DeviceEvent.DISCONNECTED);
        });

        transport.connect();

        this.state = DeviceState.CONNECTED;

        this.emitter.emit(DeviceEvent.CONNECTED);
    }

    public abstract connect(): Promise<void>;

    public disconnect(): void {
        if (this.state !== DeviceState.CONNECTED) {
            return;
        }

        this.transport?.disconnect();

        this.state = DeviceState.DISCONNECTED;
    }
}
