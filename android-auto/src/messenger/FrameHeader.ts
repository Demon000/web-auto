import { DataBuffer } from '@/utils/DataBuffer';
import { EncryptionType } from './EncryptionType';
import { FrameType } from './FrameType';
import { MessageType } from './MessageType';

export type FrameHeaderOptions = {
    serviceId: number;
    frameType: FrameType;
    encryptionType: EncryptionType;
    messageType: MessageType;
    payloadSize: number;
};

export class FrameHeader {
    public readonly serviceId: number;
    public readonly frameType: FrameType;
    public readonly encryptionType: EncryptionType;
    public readonly messageType: MessageType;
    public payloadSize: number;

    public constructor(options: FrameHeaderOptions) {
        this.serviceId = options.serviceId;
        this.frameType = options.frameType;
        this.encryptionType = options.encryptionType;
        this.messageType = options.messageType;
        this.payloadSize = options.payloadSize;
    }

    public toBuffer(): DataBuffer {
        const buffer = DataBuffer.fromSize(FrameHeader.getSizeOf());

        const firstByte = this.serviceId;
        const secondByte =
            this.frameType | this.encryptionType | this.messageType;

        buffer.appendUint8(firstByte);
        buffer.appendUint8(secondByte);
        buffer.appendUint16BE(this.payloadSize);

        return buffer;
    }

    public static getSizeOf(): number {
        return 1 + 1 + 2;
    }
}
