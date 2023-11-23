import assert from 'assert';
import { DataBuffer } from '@/utils/DataBuffer';
import { ChannelId } from './ChannelId';
import { FrameHeader } from './FrameHeader';
import { FrameType } from './FrameType';
import EventEmitter from 'eventemitter3';
import { MessageFrameOptions } from './MessageFrameOptions';

type MessageData = {
    payloads: DataBuffer[];
    totalSize: number;
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
        payloads: DataBuffer[],
        options: MessageFrameOptions,
        totalSize: number,
    ) => void;
}

export class MessageInStream {
    private messageMap = new Map<ChannelId, MessageData>();

    private receiveData?: ReceiveData;

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
            this.receiveData.payload.size <
            this.receiveData.frameHeader.payloadSize
        ) {
            return;
        }

        const payload = this.receiveData.payload.readBuffer(
            this.receiveData.frameHeader.payloadSize,
        );
        const leftoverPayload = this.receiveData.payload.readBuffer();

        await this.finishReceive(
            this.receiveData.frameHeader,
            payload,
            this.receiveData.totalSize,
        );
        this.receiveData = undefined;

        if (leftoverPayload.size !== 0) {
            await this.parseBuffer(leftoverPayload);
        }
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
            this.emitter.emit(
                MessageInStreamEvent.MESSAGE_RECEIVED,
                [payload],
                frameHeader,
                totalSize,
            );
            return;
        }

        if (frameType === FrameType.FIRST) {
            if (this.messageMap.has(channelId)) {
                throw new Error(
                    `Received new first frame for channel ${channelId} ` +
                        'but last frame was not received for previous message',
                );
            }

            messageData = {
                payloads: [],
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

        messageData.payloads.push(payload);

        if (frameType === FrameType.LAST) {
            assert(messageData);
            this.messageMap.delete(channelId);
            this.emitter.emit(
                MessageInStreamEvent.MESSAGE_RECEIVED,
                messageData.payloads,
                frameHeader,
                messageData.totalSize,
            );
        }
    }
}
