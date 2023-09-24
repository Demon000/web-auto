import { DataBuffer } from '@/utils/DataBuffer';
import { EncryptionType } from './EncryptionType';
import { FrameHeader } from './FrameHeader';
import { FrameType } from './FrameType';
import { Message } from './Message';
import { MessageFrameOptions } from './MessageFrameOptions';
import EventEmitter from 'eventemitter3';

const MAX_FRAME_PAYLOAD_SIZE = 0x4000;

export enum MessageOutStreamEvent {
    MESSAGE_SENT,
}

export interface MessageOutStreamEvents {
    [MessageOutStreamEvent.MESSAGE_SENT]: (
        payload: DataBuffer,
        frameHeader: FrameHeader,
        totalSize: number,
    ) => void;
}

export class MessageOutStream {
    public emitter = new EventEmitter<MessageOutStreamEvents>();

    public async send(
        message: Message,
        options: MessageFrameOptions,
    ): Promise<void> {
        return this.sendSplitMessage(message, options, 0);
    }

    private async sendSplitMessage(
        message: Message,
        options: MessageFrameOptions,
        offset: number,
    ): Promise<void> {
        let remainingSize = message.payload.size - offset;
        let size = remainingSize;
        if (size > MAX_FRAME_PAYLOAD_SIZE) {
            size = MAX_FRAME_PAYLOAD_SIZE;
        }
        remainingSize -= size;

        let frameType = 0;
        if (offset === 0) {
            frameType |= FrameType.FIRST;
        }
        if (remainingSize === 0) {
            frameType |= FrameType.LAST;
        }

        const rawPayload = message
            .getRawPayload()
            .subarray(offset, offset + size);

        const frameHeader = new FrameHeader({
            channelId: options.channelId,
            encryptionType: options.encryptionType,
            messageType: options.messageType,
            frameType,
            payloadSize: 0,
        });

        let totalSize = 0;
        if (frameType === FrameType.FIRST) {
            totalSize = message.getRawPayload().size;
        }

        this.emitter.emit(
            MessageOutStreamEvent.MESSAGE_SENT,
            rawPayload,
            frameHeader,
            totalSize,
        );

        offset += size;

        if (remainingSize !== 0) {
            await this.sendSplitMessage(message, options, offset);
        }
    }

    public stop(): void {
        this.emitter.removeAllListeners();
    }
}
