import EventEmitter from 'eventemitter3';
import { DataBuffer } from '../utils/DataBuffer';

export enum TransportEvent {
    DATA,
    ERROR,
}

export interface TransportEvents {
    [TransportEvent.DATA]: (data: DataBuffer) => void;
    [TransportEvent.ERROR]: (err: Error) => void;
}

export interface ITransport {
    emitter: EventEmitter<TransportEvents>;
    init(): void;
    deinit(): void;
    send(buffer: DataBuffer): Promise<void>;
}
