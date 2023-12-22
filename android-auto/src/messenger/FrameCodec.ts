import { getLogger } from '@web-auto/logging';
import { DataBuffer } from '../utils/DataBuffer.js';
import { type FrameData } from './FrameData.js';
import { type FrameHeader, FrameHeaderFlags } from './FrameHeader.js';

export class FrameCodec {
    protected logger = getLogger(this.constructor.name);
    private buffer: DataBuffer | undefined;

    public start() {}

    public stop() {
        this.buffer = undefined;
    }

    public encodeFrameHeader(
        frameheader: FrameHeader,
        buffer: DataBuffer,
    ): void {
        buffer.appendUint8(frameheader.serviceId);
        buffer.appendUint8(frameheader.flags);
        buffer.appendUint16BE(frameheader.payloadSize);
    }

    public encodeFrameData(frameData: FrameData): DataBuffer {
        const frameHeader = frameData.frameHeader;
        const totalSize = frameData.totalSize;
        const payload = frameData.payload;

        this.logger.debug('Encode frame data', frameData);

        const buffer = DataBuffer.empty();
        this.encodeFrameHeader(frameHeader, buffer);

        if (totalSize !== 0) {
            buffer.appendUint32BE(totalSize);
        }

        buffer.appendBuffer(payload);

        this.logger.debug('Encoded buffer', buffer);

        return buffer;
    }

    private decodeFrameHeader(buffer: DataBuffer): FrameHeader {
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

    private decodeTotalSize(buffer: DataBuffer): number {
        return buffer.readUint32BE();
    }

    private decodeOne(buffer: DataBuffer): FrameData {
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

    private tryDecodeOne(buffer: DataBuffer): FrameData | undefined {
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

    public decodeBuffer(buffer: DataBuffer): FrameData[] {
        this.logger.debug('Decode buffer', buffer);

        if (this.buffer !== undefined) {
            this.logger.debug(
                'Remaining buffer exists, add to it',
                this.buffer,
            );
            buffer = this.buffer.appendBuffer(buffer);
            this.logger.debug('Decoding entire buffer', buffer);
        }

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
