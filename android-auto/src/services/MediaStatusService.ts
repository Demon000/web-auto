import {
    MediaPlaybackMetadata,
    MediaPlaybackStatus,
    MediaPlaybackStatusMessageId,
} from '@web-auto/android-auto-proto';

import { Message } from '../messenger/Message.js';

import { Service, type ServiceEvents } from './Service.js';

export abstract class MediaStatusService extends Service {
    public constructor(events: ServiceEvents) {
        super(events);
    }

    protected abstract handleMetadata(
        data: MediaPlaybackMetadata,
    ): Promise<void>;

    protected abstract handlePlayback(data: MediaPlaybackStatus): Promise<void>;

    protected async onMetadata(data: MediaPlaybackMetadata): Promise<void> {
        await this.handleMetadata(data);
    }

    protected async onPlayback(data: MediaPlaybackStatus): Promise<void> {
        await this.handlePlayback(data);
    }

    public override async onSpecificMessage(
        message: Message,
    ): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId as MediaPlaybackStatusMessageId) {
            case MediaPlaybackStatusMessageId.MEDIA_PLAYBACK_METADATA:
                data = MediaPlaybackMetadata.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onMetadata(data);
                break;
            case MediaPlaybackStatusMessageId.MEDIA_PLAYBACK_STATUS:
                data = MediaPlaybackStatus.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onPlayback(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
    }
}
