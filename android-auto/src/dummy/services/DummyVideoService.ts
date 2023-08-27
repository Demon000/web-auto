import {
    AVChannel,
    AVChannelSetupRequest,
    AVChannelStartIndication,
    AVChannelStopIndication,
    AVStreamType,
    ChannelDescriptor,
    ChannelOpenRequest,
    VideoFPS,
    VideoFocusRequest,
    VideoResolution,
} from '@web-auto/android-auto-proto';
import { DataBuffer } from '@/utils/DataBuffer';
import { VideoService } from '@/services/VideoService';
import { MessageInStream } from '@/messenger/MessageInStream';
import { MessageOutStream } from '@/messenger/MessageOutStream';
import Long from 'long';

export class DummyVideoService extends VideoService {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(messageInStream, messageOutStream);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async channelStart(
        _data: AVChannelStartIndication,
    ): Promise<void> {
        // TODO
    }

    protected async setup(_data: AVChannelSetupRequest): Promise<void> {
        // TODO
    }

    protected async focus(_data: VideoFocusRequest): Promise<void> {
        // TODO
    }

    protected async channelStop(_data: AVChannelStopIndication): Promise<void> {
        // TODO
    }

    protected async handleData(
        _buffer: DataBuffer,
        _timestamp?: Long,
    ): Promise<void> {}

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.avChannel = AVChannel.create({
            streamType: AVStreamType.Enum.VIDEO,
            availableWhileInCall: true,
            videoConfigs: [
                {
                    videoResolution: VideoResolution.Enum._1080p,
                    videoFps: VideoFPS.Enum._60,
                    marginHeight: 0,
                    marginWidth: 0,
                    dpi: 140,
                },
            ],
        });
    }
}
