import {
    DataBuffer,
    type ServiceEvents,
    VideoService,
} from '@web-auto/android-auto';
import type {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
} from '@web-auto/android-auto-ipc';
import type { IpcServiceHandler } from '@web-auto/electron-ipc/common.js';
import {
    MediaCodecType,
    type ChannelOpenRequest,
    type Service,
    type Setup,
    type Start,
    type Stop,
    type VideoFocusRequestNotification,
    DisplayType,
    MediaSinkService,
} from '@web-auto/android-auto-proto';
import type { IVideoConfiguration } from '@web-auto/android-auto-proto/interfaces.js';

export class ElectronAndroidAutoVideoService extends VideoService {
    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoVideoService,
            AndroidAutoVideoClient
        >,
        private videoConfigs: IVideoConfiguration[],
        protected events: ServiceEvents,
    ) {
        super(events);

        ipcHandler.on('getVideoConfig', this.getVideoConfig.bind(this));
    }

    public async getVideoConfig(): Promise<IVideoConfiguration> {
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

    protected async channelStart(_data: Start): Promise<void> {
        // TODO
    }

    protected async setup(_data: Setup): Promise<void> {
        // TODO
    }

    protected async focus(_data: VideoFocusRequestNotification): Promise<void> {
        // TODO
    }

    protected async channelStop(_data: Stop): Promise<void> {
        // TODO
    }

    protected async handleData(
        buffer: DataBuffer,
        _timestamp?: bigint,
    ): Promise<void> {
        this.ipcHandler.data(buffer.data);
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaSinkService = new MediaSinkService({
            availableType: MediaCodecType.MEDIA_CODEC_VIDEO_H264_BP,
            videoConfigs: this.videoConfigs,
            displayId: 0,
            displayType: DisplayType.MAIN,
        });
    }
}
