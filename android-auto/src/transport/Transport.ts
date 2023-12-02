import { DataBuffer } from '../utils/DataBuffer.js';

export enum TransportState {
    AVAILABLE,
    CONNECTED,
    DISCONNECTED,
}

export interface TransportEvents {
    onData: (data: DataBuffer) => Promise<void>;
    onError: (err: Error) => Promise<void>;
    onDisconnected: () => Promise<void>;
}

export abstract class Transport {
    public state = TransportState.AVAILABLE;

    public constructor(protected events: TransportEvents) {}

    public abstract connect(): Promise<void>;
    public abstract disconnect(): Promise<void>;
    public abstract send(buffer: DataBuffer): Promise<void>;
}
