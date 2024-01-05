import { bufferWrapUint8Array } from './buffer-utils.js';

export class BufferWriter {
    private cursor = 0;

    public data;

    private constructor(size: number | undefined) {
        if (size === undefined) {
            size = 0;
        }

        this.data = Buffer.allocUnsafe(size);
    }

    public static concat(arr1: Uint8Array, arr2: Uint8Array): Uint8Array {
        const writer = this.fromSize(arr1.byteLength + arr2.byteLength);
        writer.appendBuffer(arr1);
        writer.appendBuffer(arr2);
        return writer.data;
    }

    public static fromSize(size: number): BufferWriter {
        return new BufferWriter(size);
    }

    public static empty(): BufferWriter {
        return new BufferWriter(0);
    }

    public resize(size: number): void {
        const data = Buffer.allocUnsafe(size);
        this.data.copy(data);
        this.data = data;
    }

    private appendResizeToFit(size: number): void {
        const neededSize = this.cursor + size;
        if (neededSize <= this.data.length) {
            return;
        }

        this.resize(neededSize);
    }

    public appendUint8(data: number): this {
        const size = 1;
        this.appendResizeToFit(size);
        this.data.writeUint8(data, this.cursor);
        this.cursor += size;
        return this;
    }

    public appendUint16BE(data: number): this {
        const size = 2;
        this.appendResizeToFit(size);
        this.data.writeUint16BE(data, this.cursor);
        this.cursor += size;
        return this;
    }

    public appendUint32BE(data: number): this {
        const size = 2;
        this.appendResizeToFit(size);
        this.data.writeUint32BE(data, this.cursor);
        this.cursor += size;
        return this;
    }

    public appendUint64BE(data: bigint): this {
        const size = 8;
        this.appendResizeToFit(size);
        this.data.writeBigInt64BE(data, this.cursor);
        this.cursor += size;
        return this;
    }

    public appendSeek(offset: number): this {
        this.cursor = offset;
        return this;
    }

    public appendBuffer(arr: Uint8Array): this {
        const buffer = bufferWrapUint8Array(arr);
        const size = buffer.length;
        this.appendResizeToFit(size);
        buffer.copy(this.data, this.cursor);
        this.cursor += size;
        return this;
    }
}
