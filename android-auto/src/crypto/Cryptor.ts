import { DataBuffer } from '@/utils/DataBuffer';

export abstract class Cryptor {
    public constructor(
        protected certificateBuffer: Buffer,
        protected privateKeyBuffer: Buffer,
    ) {}

    public abstract isHandshakeComplete(): boolean;
    public abstract readHandshakeBuffer(): Promise<DataBuffer>;
    public abstract writeHandshakeBuffer(buffer: DataBuffer): Promise<void>;

    public abstract encrypt(buffer: DataBuffer): Promise<DataBuffer>;
    public abstract decrypt(buffer: DataBuffer): Promise<DataBuffer>;

    public async decryptMultiple(buffers: DataBuffer[]): Promise<DataBuffer[]> {
        const promises = [];
        for (const buffer of buffers) {
            promises.push(this.decrypt(buffer));
        }

        return Promise.all(promises);
    }
}
