import assert from 'assert';

export class DataBuffer {
    private appendOffset;
    private readOffset;

    public data;

    private constructor(
        size: number | undefined,
        buffer: Buffer | undefined,
        appendOffset?: number,
        readOffset?: number,
    ) {
        if (appendOffset === undefined) {
            appendOffset = 0;
        }

        if (readOffset === undefined) {
            readOffset = 0;
        }

        this.appendOffset = appendOffset;
        this.readOffset = readOffset;

        if (size !== undefined) {
            this.data = Buffer.allocUnsafe(size);
        } else if (buffer !== undefined) {
            this.data = buffer;
        } else {
            assert(false);
        }
    }

    public static fromBuffer(
        buffer: Buffer,
        start?: number,
        end?: number,
    ): DataBuffer {
        if (start === undefined) {
            start = 0;
        }
        if (end === undefined) {
            end = buffer.length;
        }

        buffer = buffer.subarray(start, end);

        /* Buffer should already contain data, seek buffer append to end. */
        return new DataBuffer(undefined, buffer, end - start);
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
        const data = fn.call(this.data, this.readOffset);
        this.readOffset += size;
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

    public appendBuffer(buffer: Buffer, start?: number, end?: number): this {
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
