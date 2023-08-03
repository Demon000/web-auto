import { DataBuffer } from '../utils/DataBuffer';

export class DataSink {
    private buffer = DataBuffer.empty();

    public reserve(size: number): DataBuffer {
        const appendOffset = this.buffer.getAppendOffset();
        const wantedSize = appendOffset + size;

        if (wantedSize > this.buffer.size) {
            this.buffer.resize(wantedSize);
        }

        return this.buffer.subarray(appendOffset);
    }

    public commit(size: number): void {
        const appendOffset = this.buffer.getAppendOffset();
        this.buffer.appendSeek(appendOffset + size);
    }

    public getAvailableSize(): number {
        return this.buffer.readBufferSize();
    }

    public consume(size: number): DataBuffer {
        const buffer = this.buffer.readBuffer(size);
        const appendOffset = this.buffer.getAppendOffset();
        const readOffset = this.buffer.getReadOffset();
        if (appendOffset == readOffset) {
            this.buffer.readSeek(0);
            this.buffer.appendSeek(0);
        }
        return buffer.duplicate();
    }
}
