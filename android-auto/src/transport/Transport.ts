export interface TransportEvents {
    onData: (data: Uint8Array) => void;
    onError: (err: Error) => void;
    onDisconnected: () => void;
}

export abstract class Transport {
    public constructor(protected events: TransportEvents) {}

    public abstract disconnect(): Promise<void>;
    public abstract send(buffer: Uint8Array): Promise<void>;
}
