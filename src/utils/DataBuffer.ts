import assert from 'assert';

export class DataBuffer {
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

    public resize(size: number): void {
        const data = Buffer.allocUnsafe(size);
        this.data.copy(data);
        this.data = data;
    }

    public size(): number {
        return this.data.length;
    }
}
