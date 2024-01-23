export class BufferReader {
    private cursor = 0;

    private view;

    private constructor(private data: Uint8Array) {
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }

    public static fromBuffer(arr: Uint8Array): BufferReader {
        return new BufferReader(arr);
    }

    public readUint8(): number {
        const value = this.view.getUint8(this.cursor);
        this.cursor += 1;
        return value;
    }

    public readUint16BE(): number {
        const value = this.view.getUint16(this.cursor);
        this.cursor += 2;
        return value;
    }

    public readUint32BE(): number {
        const value = this.view.getUint16(this.cursor);
        this.cursor += 4;
        return value;
    }

    public readUint64BE(): bigint {
        const value = this.view.getBigUint64(this.cursor);
        this.cursor += 8;
        return value;
    }

    public readBufferSize(): number {
        return this.data.byteLength - this.cursor;
    }

    public totalBufferSize(): number {
        return this.data.byteLength;
    }

    public readBuffer(size?: number): Uint8Array {
        if (size === undefined) {
            size = this.readBufferSize();
        }

        if (this.cursor === 0 && size === this.totalBufferSize()) {
            this.cursor = this.totalBufferSize();
            return this.data;
        }

        const end = this.cursor + size;
        if (end > this.totalBufferSize()) {
            throw new Error(
                `Buffer read out of bounds, start: ${this.cursor}, ` +
                    `end: ${end}, length: ${this.totalBufferSize()}`,
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
