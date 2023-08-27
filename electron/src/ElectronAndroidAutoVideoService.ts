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
    MessageInStream,
    MessageOutStream,
    VideoService,
} from '@web-auto/android-auto';
import EventEmitter from 'eventemitter3';
import Long from 'long';

export enum ElectronAndroidAutoVideoServiceEvent {
    STOP = 'stop',
    VIDEO_DATA = 'video-data',
}

export interface ElectronAndroidAutoVideoServiceEvents {
    [ElectronAndroidAutoVideoServiceEvent.STOP]: () => void;
    [ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA]: (
        buffer: DataBuffer,
    ) => void;
}

export class ElectronAndroidAutoVideoService extends VideoService {
    public emitter = new EventEmitter<ElectronAndroidAutoVideoServiceEvents>();

    private videoConfigs: IVideoConfig[] = [];

    public constructor(
        videoConfigs: IVideoConfig[],
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(messageInStream, messageOutStream);

        for (const videoConfig of videoConfigs) {
            this.videoConfigs.push(VideoConfig.fromObject(videoConfig));
        }
    }

    public stop(): void {
        this.emitter.emit(ElectronAndroidAutoVideoServiceEvent.STOP);
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
        this.emitter.emit(
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
