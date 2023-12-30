import { bufferWrapUint8Array } from './buffer.js';

export class BufferReader {
    private cursor = 0;

    public data;

    private constructor(buffer: Buffer) {
        this.data = buffer;
    }

    public static fromBuffer(arr: Uint8Array): BufferReader {
        const buffer = bufferWrapUint8Array(arr);
        return new BufferReader(buffer);
    }

    private handleRead(size: number, fn: (offset?: number) => number): number {
        const data = fn.call(this.data, this.cursor);
        this.cursor += size;
        return data;
    }

    public readUint8(): number {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        return this.handleRead(1, this.data.readUint8);
    }

    public readUint16BE(): number {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        return this.handleRead(2, this.data.readUint16BE);
    }

    public readUint32BE(): number {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        return this.handleRead(4, this.data.readUint32BE);
    }

    public readUint64BE(): bigint {
        const size = 8;
        const data = this.data.readBigInt64BE(this.cursor);
        this.cursor += size;
        return data;
    }

    public readBufferSize(): number {
        return this.data.byteLength - this.cursor;
    }

    public readBuffer(size?: number): Uint8Array {
        if (size === undefined) {
            size = this.readBufferSize();
        }

        const end = this.cursor + size;
        if (end > this.data.byteLength) {
            throw new Error(
                `Buffer read out of bounds, start: ${this.cursor}, ` +
                    `end: ${end}, length: ${this.data.byteLength}`,
            );
        }
        const buffer = this.data.subarray(this.cursor, end);
        this.cursor += buffer.byteLength;
        return buffer;
    }

    public readSeek(offset: number): this {
        this.cursor = offset;
        return this;
    }

    public getReadOffset(): number {
        return this.cursor;
    }
}
