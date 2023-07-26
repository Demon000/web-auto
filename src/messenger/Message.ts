import { DataBuffer } from '../utils/DataBuffer';
import { ChannelId } from './ChannelId';
import { EncryptionType } from './EncryptionType';
import { FrameHeader } from './FrameHeader';
import { MessageType } from './MessageType';

export class Message {
    private _payload = DataBuffer.fromSize(0);

    public constructor(
        public readonly channelId: ChannelId,
        public readonly encryptionType: EncryptionType,
        public readonly type: MessageType,
    ) {}

    public static fromFrameHeader(frameHeader: FrameHeader): Message {
        return new Message(
            frameHeader.channelId,
            frameHeader.encryptionType,
            frameHeader.messageType,
        );
    }

    public get payload(): Buffer {
        return this._payload.data;
    }

    public insertPayload(buffer: Buffer): void {
        const offset = this._payload.size();
        this._payload.resize(offset + buffer.length);
        buffer.copy(this.payload, offset);
    }
}
