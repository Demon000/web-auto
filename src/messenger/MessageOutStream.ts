import { ICryptor } from '../ssl/ICryptor';
import { ITransport } from '../transport/ITransport';
import { DataBuffer } from '../utils/DataBuffer';
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

        const data = this.composeFrame(
            message,
            options,
            frameType,
            message.payload.data.subarray(offset, offset + size),
        );
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
        payloadBuffer: Buffer,
    ): Buffer {
        let payloadSize = 0;

        if (options.encryptionType == EncryptionType.ENCRYPTED) {
            const encryptedPayloadBuffer = DataBuffer.fromSize(0);
            payloadSize = this.cryptor.encrypt(
                encryptedPayloadBuffer,
                payloadBuffer,
            );
            payloadBuffer = encryptedPayloadBuffer.data;
        } else {
            payloadSize = payloadBuffer.length;
        }

        const frameHeader = new FrameHeader({
            channelId: options.channelId,
            encryptionType: options.encryptionType,
            messageType: options.messageType,
            totalSize: message.payload.size,
            frameType,
            payloadSize,
        });
        const frameHeaderSize = frameHeader.getSizeOf();

        const buffer = Buffer.allocUnsafe(frameHeaderSize + payloadSize);

        frameHeader.toBuffer().copy(buffer, 0);
        payloadBuffer.copy(buffer, 0 + frameHeaderSize);

        return buffer;
    }
}