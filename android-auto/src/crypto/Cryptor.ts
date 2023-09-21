import { DataBuffer } from '@/utils/DataBuffer';

export abstract class Cryptor {
    public constructor(
        protected certificateBuffer: Buffer,
        protected privateKeyBuffer: Buffer,
    ) {}
    public abstract init(): void;
    public abstract deinit(): void;

    public abstract doHandshake(): boolean;
    public abstract readHandshakeBuffer(): Promise<DataBuffer>;
    public abstract writeHandshakeBuffer(buffer: DataBuffer): Promise<void>;

    public abstract encrypt(buffer: DataBuffer): Promise<DataBuffer>;
    public abstract decrypt(buffer: DataBuffer): Promise<DataBuffer>;
}