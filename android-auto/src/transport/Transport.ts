import EventEmitter from 'eventemitter3';

import { DataBuffer } from '@/utils/DataBuffer';

export enum TransportState {
    AVAILABLE,
    CONNECTED,
    DISCONNECTED,
}

export enum TransportEvent {
    DATA,
    ERROR,
    DISCONNECTED,
}

export interface TransportEvents {
    [TransportEvent.DATA]: (data: DataBuffer) => void;
    [TransportEvent.ERROR]: (err: Error) => void;
    [TransportEvent.DISCONNECTED]: () => void;
}

export abstract class Transport {
    public emitter = new EventEmitter<TransportEvents>();

    public state = TransportState.AVAILABLE;

    public constructor(public name: string) {}

    public abstract connect(): Promise<void>;
    public abstract disconnect(): Promise<void>;
    public abstract send(buffer: DataBuffer): Promise<void>;
}
