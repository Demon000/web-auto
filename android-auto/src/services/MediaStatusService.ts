import {
    MediaPlaybackMetadata,
    MediaPlaybackStatus,
    MediaPlaybackStatusMessageId,
    MediaPlaybackStatusService,
    type Service as ProtoService,
} from '@web-auto/android-auto-proto';

import { Service, type ServiceEvents } from './Service.js';

export abstract class MediaStatusService extends Service {
    public constructor(events: ServiceEvents) {
        super(events);

        this.addMessageCallback(
            MediaPlaybackStatusMessageId.MEDIA_PLAYBACK_METADATA,
            this.onMetadata.bind(this),
            MediaPlaybackMetadata,
        );
        this.addMessageCallback(
            MediaPlaybackStatusMessageId.MEDIA_PLAYBACK_STATUS,
            this.onPlayback.bind(this),
            MediaPlaybackStatus,
        );
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

    protected override fillChannelDescriptor(
        channelDescriptor: ProtoService,
    ): void {
        channelDescriptor.mediaPlaybackService = new MediaPlaybackStatusService(
            {},
        );
    }
}
