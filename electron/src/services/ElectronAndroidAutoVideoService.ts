import {
    AVChannel,
    AVChannelSetupRequest,
    AVChannelStartIndication,
    AVChannelStopIndication,
    AVStreamType,
    ChannelDescriptor,
    ChannelOpenRequest,
    IVideoConfig,
    VideoConfig,
    VideoFocusRequest,
} from '@web-auto/android-auto-proto';
import {
    DataBuffer,
    ServiceEvents,
    VideoService,
} from '@web-auto/android-auto';
import EventEmitter from 'eventemitter3';
import Long from 'long';

export enum ElectronAndroidAutoVideoServiceEvent {
    VIDEO_START = 'video-start',
    VIDEO_DATA = 'video-data',
    VIDEO_STOP = 'video-stop',
}

export interface ElectronAndroidAutoVideoServiceEvents {
    [ElectronAndroidAutoVideoServiceEvent.VIDEO_START]: () => void;
    [ElectronAndroidAutoVideoServiceEvent.VIDEO_STOP]: () => void;
    [ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA]: (
        buffer: DataBuffer,
    ) => void;
}

export class ElectronAndroidAutoVideoService extends VideoService {
    public extraEmitter =
        new EventEmitter<ElectronAndroidAutoVideoServiceEvents>();

    private videoConfigs: IVideoConfig[] = [];

    public constructor(
        videoConfigs: IVideoConfig[],
        protected events: ServiceEvents,
    ) {
        super(events);

        for (const videoConfig of videoConfigs) {
            this.videoConfigs.push(VideoConfig.fromObject(videoConfig));
        }
    }

    public async start(): Promise<void> {
        this.extraEmitter.emit(
            ElectronAndroidAutoVideoServiceEvent.VIDEO_START,
        );
    }

    public stop(): void {
        super.stop();
        this.extraEmitter.emit(ElectronAndroidAutoVideoServiceEvent.VIDEO_STOP);
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
        _timestamp?: Long,
    ): Promise<void> {
        this.extraEmitter.emit(
            ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA,
            buffer,
        );
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.avChannel = AVChannel.create({
            streamType: AVStreamType.Enum.VIDEO,
            availableWhileInCall: true,
            videoConfigs: this.videoConfigs,
        });
    }
}
