export abstract class Cryptor {
    public constructor(
        protected certificateBuffer: Buffer,
        protected privateKeyBuffer: Buffer,
    ) {}

    public abstract start(): void;
    public abstract stop(): void;

    public abstract isHandshakeComplete(): boolean;
    public abstract readHandshakeBuffer(): Promise<Uint8Array>;
    public abstract writeHandshakeBuffer(buffer: Uint8Array): Promise<void>;

    public abstract encrypt(buffer: Uint8Array): Promise<Uint8Array>;
    public abstract decrypt(buffer: Uint8Array): Promise<Uint8Array>;
}
