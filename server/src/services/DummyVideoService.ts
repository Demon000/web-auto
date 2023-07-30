import {
    AVChannelStartIndication,
    AVChannelSetupRequest,
    VideoFocusRequest,
    AVChannelStopIndication,
    ChannelOpenRequest,
} from '../proto/types';
import { DataBuffer } from '../utils/DataBuffer';
import { VideoService } from './VideoService';

export class DummyVideoService extends VideoService {
    protected async start(data: AVChannelStartIndication): Promise<void> {
        console.trace(data);
    }
    protected async setup(data: AVChannelSetupRequest): Promise<void> {
        console.trace(data);
    }
    protected async focus(data: VideoFocusRequest): Promise<void> {
        console.trace(data);
    }
    protected async stop(data: AVChannelStopIndication): Promise<void> {
        console.trace(data);
    }
    protected async handleData(
        buffer: DataBuffer,
        timestamp?: bigint | undefined,
    ): Promise<void> {
        console.trace(buffer.data, timestamp);
    }
    protected async openChannel(data: ChannelOpenRequest): Promise<void> {
        console.trace(data);
    }
}
