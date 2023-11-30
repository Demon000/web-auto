import { getLogger } from '@web-auto/logging';
import { DataBuffer } from '../utils/DataBuffer';
import { EncryptionType } from './EncryptionType';
import { FrameData } from './FrameData';
import { FrameHeader } from './FrameHeader';
import { FrameType } from './FrameType';
import { MessageType } from './MessageType';

export class FrameCodec {
    protected logger = getLogger(this.constructor.name);
    private buffer?: DataBuffer;

    public encodeFrameData(frameData: FrameData): DataBuffer {
        const frameHeader = frameData.frameHeader;
        const totalSize = frameData.totalSize;
        const payload = frameData.payload;

        frameHeader.payloadSize = payload.size;

        this.logger.debug('Encode frame data', {
            metadata: frameData,
        });

        const buffer = DataBuffer.empty();
        buffer.appendBuffer(frameHeader.toBuffer());
        if (totalSize !== 0) {
            buffer.appendUint32BE(totalSize);
        }
        buffer.appendBuffer(payload);

        this.logger.debug('Encoded buffer', {
            metadata: buffer,
        });

        return buffer;
    }

    private decodeFrameHeader(buffer: DataBuffer): FrameHeader {
        const firstByte = buffer.readUint8();
        const secondByte = buffer.readUint8();

        const channelId = firstByte;
        const frameType = secondByte & FrameType.ATOMIC;
        const encryptionType = secondByte & EncryptionType.ENCRYPTED;
        const messageType = secondByte & MessageType.CONTROL;

        const payloadSize = buffer.readUint16BE();

        return new FrameHeader({
            channelId,
            frameType,
            encryptionType,
            messageType,
            payloadSize,
        });
    }

    private decodeTotalSize(buffer: DataBuffer): number {
        return buffer.readUint32BE();
    }

    private decodeOne(buffer: DataBuffer): FrameData {
        const frameHeader = this.decodeFrameHeader(buffer);

        let totalSize = 0;
        if (frameHeader.frameType === FrameType.FIRST) {
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
        this.logger.debug('Decode buffer', {
            metadata: buffer,
        });

        if (this.buffer !== undefined) {
            this.logger.debug('Remaining buffer exists, add to it');
            buffer = this.buffer.appendBuffer(buffer);
            this.logger.debug('Decoding entire buffer', {
                metadata: buffer,
            });
        }

        const frameDatas: FrameData[] = [];
        while (buffer.readBufferSize() !== 0) {
            const frameData = this.tryDecodeOne(buffer);
            if (frameData === undefined) {
                break;
            }
            this.logger.debug('Decoded frame data', {
                metadata: frameData,
            });
            frameDatas.push(frameData);
        }

        if (buffer.readBufferSize() !== 0) {
            this.logger.debug('Remaining buffer not empty');
            this.buffer = buffer.readBuffer();
        }

        return frameDatas;
    }
}
