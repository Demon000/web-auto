import {
    AVChannel,
    AVChannelSetupRequest,
    AVChannelStartIndication,
    AVChannelStopIndication,
    AVStreamType,
    ChannelDescriptor,
    ChannelOpenRequest,
    type IVideoConfig,
    VideoFocusRequest,
} from '@web-auto/android-auto-proto';
import {
    DataBuffer,
    type ServiceEvents,
    VideoService,
} from '@web-auto/android-auto';
import Long from 'long';
import type {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
} from '@web-auto/android-auto-ipc';
import type { IpcServiceHandler } from '@web-auto/electron-ipc/common.js';

export class ElectronAndroidAutoVideoService extends VideoService {
    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoVideoService,
            AndroidAutoVideoClient
        >,
        private videoConfigs: IVideoConfig[],
        protected events: ServiceEvents,
    ) {
        super(events);

        ipcHandler.on('getVideoConfig', this.getVideoConfig.bind(this));
    }

    public async getVideoConfig(): Promise<IVideoConfig> {
        return this.videoConfigs[0];
    }

    public async start(): Promise<void> {
        await super.start();
        this.ipcHandler.start();
    }

    public async stop(): Promise<void> {
        await super.stop();
        this.ipcHandler.stop();
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
        this.ipcHandler.data(buffer.data);
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
