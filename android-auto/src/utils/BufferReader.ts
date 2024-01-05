import { bufferWrapUint8Array } from './buffer.js';

export class BufferReader {
    private cursor = 0;
    private readUint8Bound: (offset?: number | undefined) => number;
    private readUint16BEBound: (offset?: number | undefined) => number;
    private readUint32BEBound: (offset?: number | undefined) => number;

    public data;

    private constructor(buffer: Buffer) {
        this.data = buffer;

        this.readUint8Bound = this.data.readUint8.bind(this.data);
        this.readUint16BEBound = this.data.readUint16BE.bind(this.data);
        this.readUint32BEBound = this.data.readUint32BE.bind(this.data);
    }

    public static fromBuffer(arr: Uint8Array): BufferReader {
        const buffer = bufferWrapUint8Array(arr);
        return new BufferReader(buffer);
    }

    private handleRead(size: number, fn: (offset?: number) => number): number {
        const data = fn(this.cursor);
        this.cursor += size;
        return data;
    }

    public readUint8(): number {
        return this.handleRead(1, this.readUint8Bound);
    }

    public readUint16BE(): number {
        return this.handleRead(2, this.readUint16BEBound);
    }

    public readUint32BE(): number {
        return this.handleRead(4, this.readUint32BEBound);
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
