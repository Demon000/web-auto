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
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import EventEmitter from 'eventemitter3';

export enum DummyVideoServiceEvent {
    DATA,
}

export interface DummyVideoServiceEvents {
    [DummyVideoServiceEvent.DATA]: (buffer: DataBuffer) => void;
}

export class DummyVideoService extends VideoService {
    public emitter = new EventEmitter<DummyVideoServiceEvents>();

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
        buffer: DataBuffer,
        _timestamp?: bigint | undefined,
    ): Promise<void> {
        this.emitter.emit(DummyVideoServiceEvent.DATA, buffer);
    }

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
