import EventEmitter from 'eventemitter3';

import { DataBuffer } from '@/utils/DataBuffer';

export enum TransportEvent {
    DATA,
    ERROR,
}

export interface TransportEvents {
    [TransportEvent.DATA]: (data: DataBuffer) => void;
    [TransportEvent.ERROR]: (err: Error) => void;
}

export abstract class Transport {
    public emitter = new EventEmitter<TransportEvents>();
    public abstract init(): void;
    public abstract deinit(): void;
    public abstract send(buffer: DataBuffer): Promise<void>;
}
