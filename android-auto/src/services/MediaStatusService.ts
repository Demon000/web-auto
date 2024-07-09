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
    }

    protected abstract handleMetadata(
        data: MediaPlaybackMetadata,
    ): Promise<void>;

    protected abstract handlePlayback(data: MediaPlaybackStatus): Promise<void>;

    protected async onMetadata(data: MediaPlaybackMetadata): Promise<void> {
        this.printReceive(data);
        await this.handleMetadata(data);
    }

    protected async onPlayback(data: MediaPlaybackStatus): Promise<void> {
        this.printReceive(data);
        await this.handlePlayback(data);
    }

    public override async onSpecificMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        let data;

        switch (messageId as MediaPlaybackStatusMessageId) {
            case MediaPlaybackStatusMessageId.MEDIA_PLAYBACK_METADATA:
                data = MediaPlaybackMetadata.fromBinary(payload);
                await this.onMetadata(data);
                break;
            case MediaPlaybackStatusMessageId.MEDIA_PLAYBACK_STATUS:
                data = MediaPlaybackStatus.fromBinary(payload);
                await this.onPlayback(data);
                break;
            default:
                return super.onSpecificMessage(messageId, payload);
        }

        return true;
    }

    protected override fillChannelDescriptor(
        channelDescriptor: ProtoService,
    ): void {
        channelDescriptor.mediaPlaybackService = new MediaPlaybackStatusService(
            {},
        );
    }
}
