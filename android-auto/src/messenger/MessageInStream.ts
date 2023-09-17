import assert from 'assert';
import { Cryptor } from '@/crypto/Cryptor';
import { DataBuffer } from '@/utils/DataBuffer';
import { ChannelId } from './ChannelId';
import { EncryptionType } from './EncryptionType';
import { FrameHeader } from './FrameHeader';
import { FrameType } from './FrameType';
import { Message } from './Message';
import EventEmitter from 'eventemitter3';
import { MessageFrameOptions } from './MessageFrameOptions';

type MessageData = {
    message: Message;
    currentSize: number;
    totalSize?: number;
};

type ReceiveData = {
    frameHeader: FrameHeader;
    payload: DataBuffer;
    totalSize: number;
};

export enum MessageInStreamEvent {
    MESSAGE_RECEIVED,
}

export interface MessageInStreamEvents {
    [MessageInStreamEvent.MESSAGE_RECEIVED]: (
        message: Message,
        options: MessageFrameOptions,
    ) => void;
}

export class MessageInStream {
    private messageMap = new Map<ChannelId, MessageData>();

    private receiveData?: ReceiveData;

    public constructor(private cryptor: Cryptor) {}

    public emitter = new EventEmitter<MessageInStreamEvents>();

    public async parseBuffer(buffer: DataBuffer): Promise<void> {
        if (this.receiveData) {
            await this.continueReceive(buffer);
        } else {
            await this.startReceive(buffer);
        }
    }

    private async startReceive(buffer: DataBuffer): Promise<void> {
        const frameHeader = FrameHeader.fromBuffer(buffer);
        let totalSize = 0;
        if (frameHeader.frameType === FrameType.FIRST) {
            totalSize = buffer.readUint32BE();
        }

        const payload = buffer.readBuffer();

        this.receiveData = {
            frameHeader,
            payload,
            totalSize,
        };

        await this.tryFinishReceive();
    }

    private async continueReceive(buffer: DataBuffer): Promise<void> {
        assert(this.receiveData);

        this.receiveData.payload.appendBuffer(buffer);

        await this.tryFinishReceive();
    }

    private async tryFinishReceive(): Promise<void> {
        assert(this.receiveData);

        if (
            this.receiveData.payload.size ==
            this.receiveData.frameHeader.payloadSize
        ) {
            await this.finishReceive(
                this.receiveData.frameHeader,
                this.receiveData.payload,
                this.receiveData.totalSize,
            );
            this.receiveData = undefined;
        }
    }

    private emitMessage(message: Message, frameHeader: FrameHeader): void {
        this.emitter.emit(
            MessageInStreamEvent.MESSAGE_RECEIVED,
            message,
            frameHeader,
        );
    }

    private async decryptPayload(
        frameHeader: FrameHeader,
        payload: DataBuffer,
    ): Promise<DataBuffer> {
        if (frameHeader.encryptionType != EncryptionType.ENCRYPTED) {
            return payload;
        }

        const decryptedBuffer = DataBuffer.empty();
        await this.cryptor.decrypt(decryptedBuffer, payload);
        return decryptedBuffer;
    }

    private async parseBulkMessage(
        frameHeader: FrameHeader,
        payload: DataBuffer,
    ): Promise<void> {
        payload = await this.decryptPayload(frameHeader, payload);

        const message = new Message({
            rawPayload: payload,
        });
        this.emitMessage(message, frameHeader);
    }

    private async finishReceive(
        frameHeader: FrameHeader,
        payload: DataBuffer,
        totalSize: number,
    ): Promise<void> {
        const frameType = frameHeader.frameType;
        const channelId = frameHeader.channelId;
        let messageData;

        if (frameType & FrameType.FIRST && frameType & FrameType.LAST) {
            return await this.parseBulkMessage(frameHeader, payload);
        }

        payload = await this.decryptPayload(frameHeader, payload);

        if (frameType === FrameType.FIRST) {
            const message = new Message({
                rawPayload: payload,
            });

            if (this.messageMap.has(channelId)) {
                throw new Error(
                    `Received new first frame for channel ${channelId} ` +
                        'but last frame was not received for previous message',
                );
            }

            messageData = {
                message,
                currentSize: 0,
                totalSize,
            };

            this.messageMap.set(channelId, messageData);
        } else {
            messageData = this.messageMap.get(channelId);
            if (messageData === undefined) {
                throw new Error(
                    `Received new frame for channel ${channelId} ` +
                        'but first frame was not received',
                );
            }
        }

        messageData.currentSize += payload.size;
        messageData.message.payload.appendBuffer(payload);

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
            this.emitMessage(messageData.message, frameHeader);
        }
    }

    public stop(): void {
        this.emitter.removeAllListeners();
    }
}
