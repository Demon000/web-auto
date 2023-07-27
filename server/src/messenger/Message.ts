import { DataBuffer } from '../utils/DataBuffer';
import { ChannelId } from './ChannelId';
import { EncryptionType } from './EncryptionType';
import { FrameHeader } from './FrameHeader';
import { MessageType } from './MessageType';

export type MessageOptions = {
    channelId: ChannelId;
    encryptionType: EncryptionType;
    type: MessageType;
    payload?: DataBuffer;
    messageId?: number;
};

export class Message {
    public readonly channelId: ChannelId;
    public readonly encryptionType: EncryptionType;
    public readonly type: MessageType;
    public readonly payload: DataBuffer;
    public readonly messageId?: number;

    public constructor(options: MessageOptions) {
        this.channelId = options.channelId;
        this.encryptionType = options.encryptionType;
        this.type = options.type;
        this.messageId = options.messageId;

        if (options.payload !== undefined && options.messageId === undefined) {
            this.payload = options.payload;
        } else {
            let size = 0;

            if (options.messageId !== undefined) {
                size += 2;
            }
            if (options.payload !== undefined) {
                size += options.payload.size;
            }

            this.payload = DataBuffer.fromSize(size);

            if (options.messageId !== undefined) {
                this.payload.appendUint16BE(options.messageId);
            }

            if (options.payload !== undefined) {
                this.payload.appendBuffer(options.payload);
            }
        }
    }

    public static fromFrameHeader(frameHeader: FrameHeader): Message {
        return new Message({
            channelId: frameHeader.channelId,
            encryptionType: frameHeader.encryptionType,
            type: frameHeader.messageType,
        });
    }
}
