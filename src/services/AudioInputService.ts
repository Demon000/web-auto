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
} from '../proto/types';
import { ChannelOpenRequest, ChannelDescriptor } from '../proto/types';
import { DataBuffer } from '../utils/DataBuffer';
import { AVService } from './AVService';

export class AudioInputService extends AVService {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.AV_INPUT, messageInStream, messageOutStream);
    }

    protected async setup(_data: AVChannelSetupRequest): Promise<void> {
        // TOOD
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TOOD
    }

    protected async inputOpen(_data: AVInputOpenRequest): Promise<void> {
        // TOOD
    }

    protected async onInputOpenRequest(
        data: AVInputOpenRequest,
    ): Promise<void> {
        await this.inputOpen(data);
        this.sendInputOpenResponse();
    }

    protected onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): boolean {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case AVChannelMessage.Enum.AV_INPUT_OPEN_REQUEST:
                data = AVInputOpenRequest.decode(bufferPayload);
                this.printReceive(data);
                this.onInputOpenRequest(data);
                break;
            default:
                return super.onMessage(message, options);
        }

        return true;
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

        return this.sendEncryptedSpecificMessage(
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
