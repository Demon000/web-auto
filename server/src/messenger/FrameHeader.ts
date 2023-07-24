import { ChannelId } from './ChannelId';
import { EncryptionType } from './EncryptionType';
import { FrameType } from './FrameType';
import { MessageType } from './MessageType';

export class FrameHeader {
    public constructor(
        public readonly channelId: ChannelId,
        public readonly frameType: FrameType,
        public readonly encryptionType: EncryptionType,
        public readonly messageType: MessageType,
    ) {}

    public static fromBuffer(buffer: Buffer): FrameHeader {
        const firstByte = buffer.readUint8(0);
        const secondByte = buffer.readUint8(1);

        const channelId = firstByte;
        const frameType = secondByte & FrameType.BULK;
        const encryptionType = secondByte & EncryptionType.ENCRYPTED;
        const messageType = secondByte & MessageType.CONTROL;

        return new FrameHeader(
            channelId,
            frameType,
            encryptionType,
            messageType,
        );
    }

    public toBuffer(): Buffer {
        const buffer = Buffer.allocUnsafe(this.getSizeOf());

        const firstByte = this.channelId;
        const secondByte =
            this.frameType | this.encryptionType | this.messageType;

        buffer.writeUint8(firstByte, 0);
        buffer.writeUint8(secondByte, 1);

        return buffer;
    }

    public getSizeOf(): number {
        return 2;
    }
}
