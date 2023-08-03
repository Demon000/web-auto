import EventEmitter from 'eventemitter3';
import { DataBuffer } from '../utils/DataBuffer';

export enum TransportEvent {
    DATA,
    ERROR,
}

export interface TransportEvents {
    [TransportEvent.ERROR]: (err: Error) => void;
}

export interface ITransport {
    emitter: EventEmitter<TransportEvents>;
    send(buffer: DataBuffer): Promise<void>;
    receive(size: number): Promise<DataBuffer>;
}
