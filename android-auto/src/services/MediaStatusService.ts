import {
    ChannelOpenRequest,
    MediaInfoChannelMessage,
    MediaInfoChannelMetadataData,
    MediaInfoChannelPlaybackData,
} from '@web-auto/android-auto-proto';

import { MessageFrameOptions } from '@/messenger/MessageFrameOptions';
import { Message } from '@/messenger/Message';
import { MessageInStream } from '@/messenger/MessageInStream';
import { MessageOutStream } from '@/messenger/MessageOutStream';
import { ChannelId } from '@/messenger/ChannelId';

import { Service } from './Service';

export abstract class MediaStatusService extends Service {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.MEDIA_STATUS, messageInStream, messageOutStream);
    }

    protected abstract open(_data: ChannelOpenRequest): Promise<void>;

    protected abstract handleMetadata(
        data: MediaInfoChannelMetadataData,
    ): Promise<void>;

    protected abstract handlePlayback(
        data: MediaInfoChannelPlaybackData,
    ): Promise<void>;

    protected async onMetadata(
        data: MediaInfoChannelMetadataData,
    ): Promise<void> {
        await this.handleMetadata(data);
    }

    protected async onPlayback(
        data: MediaInfoChannelPlaybackData,
    ): Promise<void> {
        await this.handlePlayback(data);
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
                await this.onMetadata(data);
                break;
            case MediaInfoChannelMessage.Enum.PLAYBACK:
                data = MediaInfoChannelPlaybackData.decode(bufferPayload);
                this.printReceive(data);
                await this.onPlayback(data);
                break;
            default:
                await super.onMessage(message, options);
        }
    }
}