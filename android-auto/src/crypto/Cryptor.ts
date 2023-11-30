import { DataBuffer } from '@/utils/DataBuffer';

export abstract class Cryptor {
    public constructor(
        protected certificateBuffer: Buffer,
        protected privateKeyBuffer: Buffer,
    ) {}

    public abstract start(): Promise<void>;
    public abstract stop(): Promise<void>;

    public abstract isHandshakeComplete(): boolean;
    public abstract readHandshakeBuffer(): Promise<DataBuffer>;
    public abstract writeHandshakeBuffer(buffer: DataBuffer): Promise<void>;

    public abstract encrypt(buffer: DataBuffer): Promise<DataBuffer>;
    public abstract decrypt(buffer: DataBuffer): Promise<DataBuffer>;
}
