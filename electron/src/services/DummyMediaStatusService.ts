import { MediaStatusService } from '@web-auto/android-auto';
import {
    ChannelOpenRequest,
    MediaPlaybackMetadata,
    MediaPlaybackStatus,
    MediaPlaybackStatusService,
    Service,
} from '@web-auto/android-auto-proto';

export class DummyMediaStatusService extends MediaStatusService {
    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async handleMetadata(
        _data: MediaPlaybackMetadata,
    ): Promise<void> {
        // TODO
    }

    protected async handlePlayback(_data: MediaPlaybackStatus): Promise<void> {
        // TODO
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaPlaybackService = new MediaPlaybackStatusService(
            {},
        );
    }
}
