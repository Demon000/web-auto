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
import { DataBuffer, VideoService } from '@web-auto/android-auto';
import EventEmitter from 'eventemitter3';

export enum ElectronVideoServiceEvent {
    DATA,
}

export interface ElectronVideoServiceEvents {
    [ElectronVideoServiceEvent.DATA]: (buffer: DataBuffer) => void;
}

export class ElectronVideoService extends VideoService {
    public emitter = new EventEmitter<ElectronVideoServiceEvents>();

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
        this.emitter.emit(ElectronVideoServiceEvent.DATA, buffer);
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
