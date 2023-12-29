export enum TransportState {
    AVAILABLE,
    CONNECTED,
    DISCONNECTED,
}

export interface TransportEvents {
    onData: (data: Uint8Array) => void;
    onError: (err: Error) => void;
    onDisconnected: () => void;
}

export abstract class Transport {
    public state = TransportState.AVAILABLE;

    public constructor(protected events: TransportEvents) {}

    public abstract connect(): Promise<void>;
    public abstract disconnect(): Promise<void>;
    public abstract send(buffer: Uint8Array): Promise<void>;
}
