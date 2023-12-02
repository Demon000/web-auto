import {
    MediaInfoChannelMessage,
    MediaInfoChannelMetadataData,
    MediaInfoChannelPlaybackData,
} from '@web-auto/android-auto-proto';

import { Message } from '../messenger/Message.js';

import { Service, type ServiceEvents } from './Service.js';

export abstract class MediaStatusService extends Service {
    public constructor(protected events: ServiceEvents) {
        super(events);
    }

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

    public async onSpecificMessage(message: Message): Promise<boolean> {
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
                return super.onSpecificMessage(message);
        }

        return true;
    }
}
