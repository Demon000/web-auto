import {
    AVChannelStartIndication,
    AVChannelSetupRequest,
    VideoFocusRequest,
    AVChannelStopIndication,
    ChannelOpenRequest,
    ChannelDescriptor,
    AVChannel,
    AVStreamType,
    VideoResolution,
    VideoFPS,
} from '../proto/types';
import { DataBuffer } from '../utils/DataBuffer';
import { VideoService } from './VideoService';

export class DummyVideoService extends VideoService {
    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async start(_data: AVChannelStartIndication): Promise<void> {
        // TODO
    }

    protected async setup(_data: AVChannelSetupRequest): Promise<void> {
        // TODO
    }

    protected async focus(_data: VideoFocusRequest): Promise<void> {
        // TODO
    }

    protected async stop(_data: AVChannelStopIndication): Promise<void> {
        // TODO
    }

    protected async handleData(
        _buffer: DataBuffer,
        _timestamp?: bigint | undefined,
    ): Promise<void> {
        // TODO
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.avChannel = AVChannel.create({
            streamType: AVStreamType.Enum.VIDEO,
            availableWhileInCall: true,
            videoConfigs: [
                {
                    videoResolution: VideoResolution.Enum._480p,
                    videoFps: VideoFPS.Enum._60,
                    marginHeight: 0,
                    marginWidth: 0,
                    dpi: 140,
                },
            ],
        });
    }
}
