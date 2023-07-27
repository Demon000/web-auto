import assert from 'assert';

export class DataBuffer {
    private appendOffset = 0;
    private readOffset = 0;

    public data;

    private constructor(size: number | undefined, buffer: Buffer | undefined) {
        if (size !== undefined) {
            this.data = Buffer.allocUnsafe(size);
        } else if (buffer !== undefined) {
            this.data = buffer;
        } else {
            assert(false);
        }
    }

    public static fromBuffer(buffer: Buffer): DataBuffer {
        return new DataBuffer(undefined, buffer);
    }

    public static fromSize(size: number): DataBuffer {
        return new DataBuffer(size, undefined);
    }

    public static empty(): DataBuffer {
        return new DataBuffer(0, undefined);
    }

    public resize(size: number): void {
        const data = Buffer.allocUnsafe(size);
        this.data.copy(data);
        this.data = data;
    }

    private appendResizeToFit(size: number): void {
        const neededSize = this.appendOffset + size;
        if (neededSize <= this.size) {
            return;
        }

        this.resize(neededSize);
    }

    public handleAppend(
        data: number,
        size: number,
        fn: (value: number, offset?: number) => void,
    ): this {
        this.appendResizeToFit(size);
        fn.call(this.data, data, this.appendOffset);
        this.appendOffset += size;
        return this;
    }

    public handleRead(size: number, fn: (offset?: number) => number): number {
        this.appendResizeToFit(size);
        const data = fn.call(this.data, this.readOffset);
        this.appendOffset += size;
        return data;
    }

    public appendUint8(data: number): this {
        return this.handleAppend(data, 1, this.data.writeUint8);
    }

    public appendUint16BE(data: number): this {
        return this.handleAppend(data, 2, this.data.writeUint16BE);
    }

    public appendUint32BE(data: number): this {
        return this.handleAppend(data, 4, this.data.writeUint32BE);
    }

    public appendSeek(offset: number): this {
        this.appendOffset = offset;
        return this;
    }

    public readUint16BE(): number {
        return this.handleRead(2, this.data.readUint16BE);
    }

    public readSeek(offset: number): this {
        this.readOffset = offset;
        return this;
    }

    public appendBuffer(
        buffer: Buffer | DataBuffer,
        start?: number,
        end?: number,
    ): this {
        if (buffer instanceof DataBuffer) {
            buffer = buffer.data;
        }

        if (start === undefined) {
            start = 0;
        }

        if (end === undefined) {
            end = buffer.length;
        }

        const size = end - start;
        this.appendResizeToFit(size);
        buffer.copy(this.data, this.appendOffset, start, end);
        this.appendOffset += size;

        return this;
    }

    public get size(): number {
        return this.data.length;
    }
}
