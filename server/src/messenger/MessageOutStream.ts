import { ICryptor } from '../ssl/ICryptor';
import { ITransport } from '../transport/ITransport';
import { DataBuffer } from '../utils/DataBuffer';
import { EncryptionType } from './EncryptionType';
import { FrameHeader } from './FrameHeader';
import { FrameSize } from './FrameSize';
import { FrameType } from './FrameType';
import { Message } from './Message';

const MAX_FRAME_PAYLOAD_SIZE = 0x4000;

export class MessageOutStream {
    public constructor(
        private transport: ITransport,
        private cryptor: ICryptor,
    ) {}

    public async send(message: Message): Promise<void> {
        return this.sendSplitMessage(message, 0);
    }

    private async sendSplitMessage(
        message: Message,
        offset: number,
    ): Promise<void> {
        let remainingSize = message.payload.length - offset;
        let size = remainingSize;
        if (size > MAX_FRAME_PAYLOAD_SIZE) {
            size = MAX_FRAME_PAYLOAD_SIZE;
        }
        remainingSize -= size;

        let frameType = 0;
        if (offset === 0 && remainingSize === 0) {
            frameType = FrameType.BULK;
        } else if (offset === 0) {
            frameType = FrameType.FIRST;
        } else if (remainingSize === 0) {
            frameType = FrameType.LAST;
        }

        const data = this.composeFrame(
            message,
            frameType,
            message.payload.subarray(offset, offset + size),
        );
        await this.transport.send(data);

        offset += size;

        if (remainingSize !== 0) {
            await this.sendSplitMessage(message, offset);
        }
    }

    private composeFrame(
        message: Message,
        frameType: FrameType,
        payloadBuffer: Buffer,
    ): Buffer {
        let payloadSize = 0;

        if (message.encryptionType == EncryptionType.ENCRYPTED) {
            const encryptedPayloadBuffer = DataBuffer.fromSize(0);
            payloadSize = this.cryptor.encrypt(
                encryptedPayloadBuffer,
                payloadBuffer,
            );
            payloadBuffer = encryptedPayloadBuffer.data;
        } else {
            payloadSize = payloadBuffer.length;
        }

        const frameHeader = new FrameHeader(
            message.channelId,
            frameType,
            message.encryptionType,
            message.type,
        );
        const frameHeaderSize = FrameHeader.getSizeOf();

        const frameSize = new FrameSize(
            payloadSize,
            frameType === FrameType.FIRST ? message.payload.length : 0,
        );
        const frameSizeSize = frameSize.getSizeOf();

        const buffer = Buffer.allocUnsafe(
            frameHeaderSize + frameSizeSize + payloadSize,
        );
        frameHeader.toBuffer().copy(buffer, 0);
        frameSize.toBuffer().copy(buffer, 0 + frameHeaderSize);
        payloadBuffer.copy(buffer, 0 + frameHeaderSize + frameSizeSize);

        return buffer;
    }
}
