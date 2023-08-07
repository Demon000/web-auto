import { ICryptor } from '@/ssl/ICryptor';
import { ITransport } from '@/transport/ITransport';
import { DataBuffer } from '@/utils/DataBuffer';
import { EncryptionType } from './EncryptionType';
import { FrameHeader } from './FrameHeader';
import { FrameType } from './FrameType';
import { Message } from './Message';
import { MessageFrameOptions } from './MessageFrameOptions';

const MAX_FRAME_PAYLOAD_SIZE = 0x4000;

export class MessageOutStream {
    public constructor(
        private transport: ITransport,
        private cryptor: ICryptor,
    ) {}

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
        const data = this.composeFrame(message, options, frameType, rawPayload);
        await this.transport.send(data);

        offset += size;

        if (remainingSize !== 0) {
            await this.sendSplitMessage(message, options, offset);
        }
    }

    private composeFrame(
        message: Message,
        options: MessageFrameOptions,
        frameType: FrameType,
        payloadBuffer: DataBuffer,
    ): DataBuffer {
        let payloadSize = 0;

        if (options.encryptionType == EncryptionType.ENCRYPTED) {
            const encryptedPayloadBuffer = DataBuffer.empty();
            payloadSize = this.cryptor.encrypt(
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
}
