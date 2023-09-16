import { DataBuffer } from '@/utils/DataBuffer';

export abstract class Cryptor {
    public constructor(
        protected certificateBuffer: Buffer,
        protected privateKeyBuffer: Buffer,
    ) {}
    public abstract init(): void;
    public abstract deinit(): void;

    public abstract doHandshake(): boolean;
    public abstract readHandshakeBuffer(): DataBuffer;
    public abstract writeHandshakeBuffer(buffer: DataBuffer): void;

    public abstract encrypt(output: DataBuffer, input: DataBuffer): number;
    public abstract decrypt(output: DataBuffer, input: DataBuffer): number;
}
