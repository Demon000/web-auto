import { ICryptor } from '../ssl/ICryptor';
import { ITransport } from '../transport/ITransport';
import { DataBuffer } from '../utils/DataBuffer';
import { EncryptionType } from './EncryptionType';
import { FrameHeader } from './FrameHeader';
import { FrameSize } from './FrameSize';
import { FrameSizeType } from './FrameSizeType';
import { FrameType } from './FrameType';
import { Message } from './Message';

export class MessageInStream {
    public constructor(
        private transport: ITransport,
        private cryptor: ICryptor,
    ) {}

    public async receive(): Promise<Message> {
        const frameHeader = await this.receiveFrameHeader();
        const message = Message.fromFrameHeader(frameHeader);
        await this.receiveIntoMessage(frameHeader, message);
        return message;
    }

    private async receiveFrameHeader(): Promise<FrameHeader> {
        const frameHeaderSize = FrameHeader.getSizeOf();
        const frameHeaderBuffer = await this.transport.receive(frameHeaderSize);
        return FrameHeader.fromBuffer(frameHeaderBuffer);
    }

    private async receiveIntoMessage(
        frameHeader: FrameHeader,
        message: Message,
    ): Promise<void> {
        if (
            frameHeader.channelId !== message.channelId ||
            frameHeader.encryptionType !== message.encryptionType ||
            frameHeader.messageType !== message.type
        ) {
            throw new Error('Messages received out of order, implement map.');
        }

        const frameSizeSize = FrameSize.getSizeOf(
            frameHeader.frameType == FrameType.FIRST
                ? FrameSizeType.EXTENDED
                : FrameSizeType.SHORT,
        );
        const frameSizeBuffer = await this.transport.receive(frameSizeSize);
        const frameSize = FrameSize.fromBuffer(frameSizeBuffer);

        const payloadSize = frameSize.frameSize;
        let payload = await this.transport.receive(payloadSize);

        if (message.encryptionType == EncryptionType.ENCRYPTED) {
            const buffer = DataBuffer.fromSize(0);
            this.cryptor.decrypt(buffer, payload);
            payload = buffer.data;
        }

        message.insertPayload(payload);

        if (
            frameHeader.frameType !== FrameType.BULK &&
            frameHeader.frameType !== FrameType.LAST
        ) {
            const frameHeader = await this.receiveFrameHeader();
            await this.receiveIntoMessage(frameHeader, message);
        }
    }
}
