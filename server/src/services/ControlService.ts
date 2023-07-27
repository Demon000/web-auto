import { ChannelId } from '../messenger/ChannelId';
import { EncryptionType } from '../messenger/EncryptionType';
import { Message } from '../messenger/Message';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { MessageType } from '../messenger/MessageType';
import { Service } from './Service';
import { lookupEnum } from '../proto/proto';
import { DataBuffer } from '../utils/DataBuffer';

export class ControlService extends Service {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.CONTROL, messageInStream, messageOutStream);
    }

    public async sendVersionRequest(): Promise<void> {
        const ControlMessage = lookupEnum('ids.ControlMessage.Enum');

        const payload = DataBuffer.fromSize(0);
        payload.appendUint16BE(1).appendUint16BE(1);

        const message = new Message({
            messageId: ControlMessage.values.VERSION_REQUEST,
            payload,
        });

        this.messageOutStream.send(message, {
            channelId: this.channelId,
            encryptionType: EncryptionType.PLAIN,
            messageType: MessageType.SPECIFIC,
        });
    }
}
