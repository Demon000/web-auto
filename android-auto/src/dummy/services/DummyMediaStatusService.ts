import {
    ChannelDescriptor,
    ChannelOpenRequest,
    MediaInfoChannelMetadataData,
    MediaInfoChannelPlaybackData,
} from '@web-auto/android-auto-proto';
import { MediaStatusService } from '@/services/MediaStatusService';

export class DummyMediaStatusService extends MediaStatusService {
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

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.mediaInfoChannel = {};
    }
}
