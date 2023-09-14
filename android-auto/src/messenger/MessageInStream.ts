import assert from 'assert';
import { ICryptor } from '@/ssl/ICryptor';
import { DataBuffer } from '@/utils/DataBuffer';
import { ChannelId } from './ChannelId';
import { EncryptionType } from './EncryptionType';
import { FrameHeader } from './FrameHeader';
import { FrameType } from './FrameType';
import { Message } from './Message';
import EventEmitter from 'eventemitter3';
import { MessageFrameOptions } from './MessageFrameOptions';
import { ITransport } from '@/transport/ITransport';

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
    private emitterMap = new Map<
        ChannelId,
        EventEmitter<MessageInStreamEvents>
    >();

    private receiveData?: ReceiveData;

    public constructor(
        private transport: ITransport,
        private cryptor: ICryptor,
    ) {}

    public emitter = new EventEmitter<MessageInStreamEvents>();

    public parseBuffer(buffer: DataBuffer): void {
        if (this.receiveData) {
            this.continueReceive(buffer);
        } else {
            this.startReceive(buffer);
        }
    }

    private startReceive(buffer: DataBuffer): void {
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

        this.tryFinishReceive();
    }

    private continueReceive(buffer: DataBuffer): void {
        assert(this.receiveData);

        this.receiveData.payload.appendBuffer(buffer);

        this.tryFinishReceive();
    }

    private tryFinishReceive(): void {
        assert(this.receiveData);

        if (
            this.receiveData.payload.size ==
            this.receiveData.frameHeader.payloadSize
        ) {
            this.finishReceive(
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

        const emitter = this.optionalChannelEmitter(frameHeader.channelId);
        if (!emitter) {
            console.log(
                `Unhandled message with id ${message.messageId} on channel with id ${frameHeader.channelId}`,
                message.getPayload(),
                frameHeader,
            );
            return;
        }

        emitter.emit(
            MessageInStreamEvent.MESSAGE_RECEIVED,
            message,
            frameHeader,
        );
    }

    private decryptPayload(
        frameHeader: FrameHeader,
        payload: DataBuffer,
    ): DataBuffer {
        if (frameHeader.encryptionType != EncryptionType.ENCRYPTED) {
            return payload;
        }

        const decryptedBuffer = DataBuffer.empty();
        this.cryptor.decrypt(decryptedBuffer, payload);
        return decryptedBuffer;
    }

    private parseBulkMessage(
        frameHeader: FrameHeader,
        payload: DataBuffer,
    ): void {
        payload = this.decryptPayload(frameHeader, payload);

        const message = new Message({
            rawPayload: payload,
        });
        this.emitMessage(message, frameHeader);
    }

    private finishReceive(
        frameHeader: FrameHeader,
        payload: DataBuffer,
        totalSize: number,
    ): void {
        const frameType = frameHeader.frameType;
        const channelId = frameHeader.channelId;
        let messageData;

        if (frameType & FrameType.FIRST && frameType & FrameType.LAST) {
            return this.parseBulkMessage(frameHeader, payload);
        }

        payload = this.decryptPayload(frameHeader, payload);

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

    public optionalChannelEmitter(
        channelId: ChannelId,
    ): EventEmitter<MessageInStreamEvents> | undefined {
        return this.emitterMap.get(channelId);
    }

    public channelEmitter(
        channelId: ChannelId,
    ): EventEmitter<MessageInStreamEvents> {
        let emitter = this.emitterMap.get(channelId);
        if (emitter === undefined) {
            emitter = new EventEmitter<MessageInStreamEvents>();
            this.emitterMap.set(channelId, emitter);
        }

        return emitter;
    }
}
