import { DataBuffer } from '../utils/DataBuffer';
import { ChannelId } from './ChannelId';
import { EncryptionType } from './EncryptionType';
import { FrameType } from './FrameType';
import { MessageType } from './MessageType';

export type FrameHeaderOptions = {
    channelId: ChannelId;
    frameType: FrameType;
    encryptionType: EncryptionType;
    messageType: MessageType;
    payloadSize: number;
    totalSize: number;
};

export class FrameHeader {
    public readonly channelId: ChannelId;
    public readonly frameType: FrameType;
    public readonly encryptionType: EncryptionType;
    public readonly messageType: MessageType;
    public readonly payloadSize: number;
    public readonly totalSize: number;

    public constructor(options: FrameHeaderOptions) {
        this.channelId = options.channelId;
        this.frameType = options.frameType;
        this.encryptionType = options.encryptionType;
        this.messageType = options.messageType;
        this.payloadSize = options.payloadSize;
        this.totalSize = 0;

        if (
            options.frameType === FrameType.FIRST &&
            options.totalSize !== undefined
        ) {
            this.totalSize = options.totalSize;
        }
    }

    public static fromBuffer(buffer: DataBuffer): FrameHeader {
        const firstByte = buffer.readUint8();
        const secondByte = buffer.readUint8();

        const channelId = firstByte;
        const frameType = secondByte & (FrameType.FIRST | FrameType.LAST);
        const encryptionType = secondByte & EncryptionType.ENCRYPTED;
        const messageType = secondByte & MessageType.CONTROL;

        const payloadSize = buffer.readUint16BE();
        let totalSize = 0;
        if (frameType === FrameType.FIRST) {
            totalSize = buffer.readUint16BE();
        }

        return new FrameHeader({
            channelId,
            frameType,
            encryptionType,
            messageType,
            payloadSize,
            totalSize,
        });
    }

    public toBuffer(): DataBuffer {
        const buffer = DataBuffer.fromSize(this.getSizeOf());

        const firstByte = this.channelId;
        const secondByte =
            this.frameType | this.encryptionType | this.messageType;

        buffer.appendUint8(firstByte);
        buffer.appendUint8(secondByte);
        buffer.appendUint16BE(this.payloadSize);
        if (this.frameType === FrameType.FIRST) {
            buffer.appendUint32BE(this.totalSize);
        }

        return buffer;
    }

    public getSizeOf(): number {
        let size = 1 + 1 + 2;
        if (this.frameType === FrameType.FIRST) {
            size += 4;
        }
        return size;
    }
}
