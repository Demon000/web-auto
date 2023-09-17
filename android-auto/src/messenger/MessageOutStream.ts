import { Cryptor } from '@/crypto/Cryptor';
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
    [MessageOutStreamEvent.MESSAGE_SENT]: (data: DataBuffer) => void;
}

export class MessageOutStream {
    public emitter = new EventEmitter<MessageOutStreamEvents>();

    public constructor(private cryptor: Cryptor) {}

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
        const data = await this.composeFrame(
            message,
            options,
            frameType,
            rawPayload,
        );
        this.emitter.emit(MessageOutStreamEvent.MESSAGE_SENT, data);

        offset += size;

        if (remainingSize !== 0) {
            await this.sendSplitMessage(message, options, offset);
        }
    }

    private async composeFrame(
        message: Message,
        options: MessageFrameOptions,
        frameType: FrameType,
        payloadBuffer: DataBuffer,
    ): Promise<DataBuffer> {
        let payloadSize = 0;

        if (options.encryptionType == EncryptionType.ENCRYPTED) {
            const encryptedPayloadBuffer = DataBuffer.empty();
            payloadSize = await this.cryptor.encrypt(
                encryptedPayloadBuffer,
                payloadBuffer,
            );
            payloadBuffer = encryptedPayloadBuffer;
        } else {
            payloadSize = payloadBuffer.size;
        }

        const frameHeader = new FrameHeader({
            channelId: options.channelId,
            encryptionType: options.encryptionType,
            messageType: options.messageType,
            frameType,
            payloadSize,
        });

        const buffer = DataBuffer.empty();

        buffer.appendBuffer(frameHeader.toBuffer());

        if (frameType === FrameType.FIRST) {
            buffer.appendUint32BE(message.getRawPayload().size);
        }

        buffer.appendBuffer(payloadBuffer);

        return buffer;
    }

    public stop(): void {
        this.emitter.removeAllListeners();
    }
}
