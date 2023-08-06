import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import {
    AVChannelMessage,
    AVChannelSetupRequest,
    AVInputChannel,
    AVInputOpenRequest,
    AVInputOpenResponse,
    AVStreamType,
} from '@web-auto/protos/types';
import { ChannelOpenRequest, ChannelDescriptor } from '@web-auto/protos/types';
import { DataBuffer } from '../utils/DataBuffer';
import { AVService } from './AVService';

export abstract class AudioInputService extends AVService {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.AV_INPUT, messageInStream, messageOutStream);
    }

    protected abstract setup(data: AVChannelSetupRequest): Promise<void>;

    protected abstract open(data: ChannelOpenRequest): Promise<void>;

    protected abstract inputOpen(data: AVInputOpenRequest): Promise<void>;

    protected async onInputOpenRequest(
        data: AVInputOpenRequest,
    ): Promise<void> {
        await this.inputOpen(data);
        this.sendInputOpenResponse();
    }

    protected async onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case AVChannelMessage.Enum.AV_INPUT_OPEN_REQUEST:
                data = AVInputOpenRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onInputOpenRequest(data);
                break;
            default:
                await super.onMessage(message, options);
        }
    }

    protected async sendInputOpenResponse(): Promise<void> {
        if (this.session === undefined) {
            console.log(
                'Cannot send input open response because session id is undefined',
            );
            return;
        }

        const data = AVInputOpenResponse.create({
            value: 0,
            session: this.session,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            AVInputOpenResponse.encode(data).finish(),
        );

        await this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.AV_INPUT_OPEN_RESPONSE,
            payload,
        );
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.avInputChannel = AVInputChannel.create({
            streamType: AVStreamType.Enum.AUDIO,
            audioConfig: {
                sampleRate: 16000,
                bitDepth: 16,
                channelCount: 1,
            },
        });
    }
}
