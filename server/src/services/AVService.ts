import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import {
    AVChannelMessage,
    AVChannelSetupRequest,
    AVChannelSetupResponse,
    AVChannelSetupStatus,
} from '../proto/types';
import { DataBuffer } from '../utils/DataBuffer';
import { Service } from './Service';

export abstract class AVService extends Service {
    protected session?: number;

    public constructor(
        channelId: ChannelId,
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(channelId, messageInStream, messageOutStream);
    }

    protected async onSetupRequest(data: AVChannelSetupRequest): Promise<void> {
        let status = false;

        try {
            await this.setup(data);
            status = true;
        } catch (e) {
            console.log(e);
        }

        return this.sendSetupResponse(status);
    }

    protected async onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case AVChannelMessage.Enum.SETUP_REQUEST:
                data = AVChannelSetupRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onSetupRequest(data);
                break;
            default:
                await super.onMessage(message, options);
        }
    }

    protected abstract setup(data: AVChannelSetupRequest): Promise<void>;

    protected async sendSetupResponse(status: boolean): Promise<void> {
        const data = AVChannelSetupResponse.create({
            maxUnacked: 1,
            mediaStatus: status
                ? AVChannelSetupStatus.Enum.OK
                : AVChannelSetupStatus.Enum.FAIL,
            configs: [0],
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            AVChannelSetupResponse.encode(data).finish(),
        );

        return this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.SETUP_RESPONSE,
            payload,
        );
    }
}
