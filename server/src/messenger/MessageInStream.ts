import assert from 'assert';
import { ICryptor } from '../ssl/ICryptor';
import { DataBuffer } from '../utils/DataBuffer';
import { ChannelId } from './ChannelId';
import { EncryptionType } from './EncryptionType';
import { FrameHeader } from './FrameHeader';
import { FrameType } from './FrameType';
import { Message } from './Message';

type MessageData = {
    message: Message;
    currentSize: number;
    totalSize?: number;
};

export class MessageInStream {
    private messageMap = new Map<ChannelId, MessageData>();

    public constructor(private cryptor: ICryptor) {}

    public parseBuffer(buffer: Buffer): Message | undefined {
        const frameHeader = FrameHeader.fromBuffer(buffer);
        const frameHeaderSize = frameHeader.getSizeOf();
        const frameType = frameHeader.frameType;
        const channelId = frameHeader.channelId;
        const isBulk =
            frameType & FrameType.FIRST && frameType & FrameType.LAST;
        let messageData;
        let message;

        if (isBulk) {
            message = new Message();
        } else if (frameType === FrameType.FIRST) {
            message = new Message();

            if (this.messageMap.has(channelId)) {
                throw new Error(
                    `Received new first frame for channel ${channelId} ` +
                        'but last frame was not received for previous message',
                );
            }

            if (frameType === FrameType.FIRST) {
                messageData = {
                    message,
                    currentSize: 0,
                    totalSize: frameHeader.totalSize,
                };

                this.messageMap.set(channelId, messageData);
            }
        } else {
            messageData = this.messageMap.get(channelId);
            if (messageData === undefined) {
                throw new Error(
                    `Received new frame for channel ${channelId} ` +
                        'but first frame was not received',
                );
            }
            message = messageData.message;
        }

        let payload = buffer.subarray(frameHeaderSize);
        if (frameHeader.encryptionType == EncryptionType.ENCRYPTED) {
            const decryptedBuffer = DataBuffer.empty();
            this.cryptor.decrypt(decryptedBuffer, payload);
            payload = decryptedBuffer.data;
        }

        if (!isBulk) {
            assert(messageData);
            messageData.currentSize += payload.length;
        }

        message.appendBuffer(payload);

        if (frameType === FrameType.LAST) {
            assert(messageData);
            if (messageData.currentSize !== messageData.totalSize) {
                throw new Error(
                    `Received last frame for channel ${channelId} ` +
                        `but current size ${messageData.currentSize} does not ` +
                        `match total size ${messageData.totalSize}`,
                );
            }

            this.messageMap.delete(channelId);
        }

        if (frameType & FrameType.LAST) {
            return message;
        }

        return undefined;
    }
}
