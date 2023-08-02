import { ChannelDescriptor, ChannelOpenRequest } from '../proto/types';
import { Service } from './Service';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { Message } from '../messenger/Message';
import { MediaInfoChannelMessage } from '../proto/types';
import { MediaInfoChannelMetadataData } from '../proto/types';
import { MediaInfoChannelPlaybackData } from '../proto/types';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { ChannelId } from '../messenger/ChannelId';

export class MediaStatusService extends Service {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.MEDIA_STATUS, messageInStream, messageOutStream);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async handleMetadata(
        _data: MediaInfoChannelMetadataData,
    ): Promise<void> {
        // TODO
    }

    protected async handlePlayback(
        _data: MediaInfoChannelPlaybackData,
    ): Promise<void> {
        // TODO
    }

    protected async onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case MediaInfoChannelMessage.Enum.METADATA:
                data = MediaInfoChannelMetadataData.decode(bufferPayload);
                this.printReceive(data);
                await this.handleMetadata(data);
                break;
            case MediaInfoChannelMessage.Enum.PLAYBACK:
                data = MediaInfoChannelPlaybackData.decode(bufferPayload);
                this.printReceive(data);
                await this.handlePlayback(data);
                break;
            default:
                await super.onMessage(message, options);
        }
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.mediaInfoChannel = {};
    }
}
