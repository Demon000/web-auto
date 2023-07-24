import assert from 'assert';
import { FrameSizeType } from './FrameSizeType';

export class FrameSize {
    private frameSizeType: FrameSizeType;

    public constructor(
        public readonly frameSize: number,
        public readonly totalSize = 0,
    ) {
        if (totalSize === 0) {
            this.frameSizeType = FrameSizeType.SHORT;
        } else {
            this.frameSizeType = FrameSizeType.EXTENDED;
        }
    }

    public static fromBuffer(buffer: Buffer): FrameSize {
        let frameSize;
        let totalSize;

        if (buffer.length >= 2) {
            frameSize = buffer.readUint16BE(0);
            totalSize = 0;
        }

        if (buffer.length >= 6) {
            totalSize = buffer.readUint32BE(2);
        }

        assert(frameSize !== undefined);

        return new FrameSize(frameSize, totalSize);
    }

    public toBuffer(): Buffer {
        const buffer = Buffer.allocUnsafe(this.getSizeOf());

        buffer.writeUint16BE(this.frameSize, 0);

        if (this.frameSizeType === FrameSizeType.EXTENDED) {
            buffer.writeUint32BE(this.totalSize, 2);
        }

        return buffer;
    }

    public getSizeOf(): number {
        return this.frameSizeType === FrameSizeType.SHORT ? 2 : 6;
    }
}
