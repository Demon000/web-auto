import { getLogger } from '@web-auto/logging';
import { type FrameData } from './FrameData.js';
import { type FrameHeader, FrameHeaderFlags } from './FrameHeader.js';
import { BufferWriter, BufferReader } from '../utils/buffer.js';

export class FrameCodec {
    protected logger = getLogger(this.constructor.name);
    private buffer: Uint8Array | undefined;

    public start() {}

    public stop() {
        this.buffer = undefined;
    }

    public encodeFrameHeader(
        frameheader: FrameHeader,
        buffer: BufferWriter,
    ): void {
        buffer.appendUint8(frameheader.serviceId);
        buffer.appendUint8(frameheader.flags);
        buffer.appendUint16BE(frameheader.payloadSize);
    }

    public encodeFrameData(frameData: FrameData): Uint8Array {
        const frameHeader = frameData.frameHeader;
        const totalSize = frameData.totalSize;
        const payload = frameData.payload;

        this.logger.debug('Encode frame data', frameData);

        const buffer = BufferWriter.empty();
        this.encodeFrameHeader(frameHeader, buffer);

        if (totalSize !== 0) {
            buffer.appendUint32BE(totalSize);
        }

        buffer.appendBuffer(payload);

        this.logger.debug('Encoded buffer', buffer);

        return buffer.data;
    }

    private decodeFrameHeader(buffer: BufferReader): FrameHeader {
        const firstByte = buffer.readUint8();
        const secondByte = buffer.readUint8();

        const serviceId = firstByte;
        const flags = secondByte;

        const payloadSize = buffer.readUint16BE();

        return {
            serviceId,
            flags,
            payloadSize,
        };
    }

    private decodeTotalSize(buffer: BufferReader): number {
        return buffer.readUint32BE();
    }

    private decodeOne(buffer: BufferReader): FrameData {
        const frameHeader = this.decodeFrameHeader(buffer);

        let totalSize = 0;
        if (
            frameHeader.flags & FrameHeaderFlags.FIRST &&
            !(frameHeader.flags & FrameHeaderFlags.LAST)
        ) {
            totalSize = this.decodeTotalSize(buffer);
        }

        const payload = buffer.readBuffer(frameHeader.payloadSize);

        return {
            frameHeader,
            payload,
            totalSize,
        };
    }

    private tryDecodeOne(buffer: BufferReader): FrameData | undefined {
        const initialReadOffset = buffer.getReadOffset();
        this.logger.debug(`Buffer read offset: ${initialReadOffset}`);

        try {
            return this.decodeOne(buffer);
        } catch (err) {
            buffer.readSeek(initialReadOffset);
            this.logger.debug(
                'Buffer not big enough to decode one frame data, roll back read offset',
            );
            return undefined;
        }
    }

    public decodeBuffer(arr: Uint8Array): FrameData[] {
        this.logger.debug('Decode buffer', arr);
        if (this.buffer !== undefined) {
            arr = BufferWriter.concat(this.buffer, arr);
            this.logger.debug(
                'Remaining buffer exists, add to it',
                this.buffer,
            );
            this.logger.debug('Decoding entire buffer', arr);
        }

        const buffer = BufferReader.fromBuffer(arr);
        const frameDatas: FrameData[] = [];
        while (buffer.readBufferSize() !== 0) {
            const frameData = this.tryDecodeOne(buffer);
            if (frameData === undefined) {
                break;
            }
            this.logger.debug('Decoded frame data', {
                frameData,
                buffer,
            });
            frameDatas.push(frameData);
        }

        if (buffer.readBufferSize() === 0) {
            this.logger.debug('Remaining buffer empty');
            this.buffer = undefined;
        } else {
            this.logger.debug('Remaining buffer not empty', buffer);
            this.buffer = buffer.readBuffer();
        }

        return frameDatas;
    }
}
