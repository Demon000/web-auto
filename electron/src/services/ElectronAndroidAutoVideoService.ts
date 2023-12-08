import {
    DataBuffer,
    type ServiceEvents,
    VideoService,
} from '@web-auto/android-auto';
import type {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
    VideoCodecConfig,
} from '@web-auto/android-auto-ipc';
import type { IpcServiceHandler } from '@web-auto/electron-ipc/common.js';
import {
    type ChannelOpenRequest,
    type Service,
    type Setup,
    type Start,
    type VideoFocusRequestNotification,
    DisplayType,
    MediaSinkService,
    MediaCodecType,
    VideoFocusNotification,
} from '@web-auto/android-auto-proto';
import assert from 'node:assert';
import {
    h264HasKeyFrame,
    h264ParseConfiguration,
    toHex,
} from '../codec/h264.js';
import type {
    IVideoConfiguration,
    IVideoFocusNotification,
} from '@web-auto/android-auto-proto/interfaces.js';

enum CodecState {
    STOPPED,
    WAITING_FOR_CONFIG,
    WAITING_FOR_FIRST_FRAME,
    STARTED,
}

export class ElectronAndroidAutoVideoService extends VideoService {
    private codecState = CodecState.STOPPED;
    private codecBuffer?: DataBuffer;

    private isSetup = false;

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
        ipcHandler.on(
            'sendVideoFocusNotification',
            this.sendVideoFocusNotificationObject.bind(this),
        );
        ipcHandler.on('isSetup', this.getIsSetup.bind(this));
    }

    public async getVideoConfig(): Promise<IVideoConfiguration> {
        return this.videoConfigs[0];
    }

    public async sendVideoFocusNotificationObject(
        data: IVideoFocusNotification,
    ): Promise<void> {
        await this.sendVideoFocusIndication(new VideoFocusNotification(data));
    }

    public async getIsSetup(): Promise<boolean> {
        return this.isSetup;
    }

    public async stop(): Promise<void> {
        await this.channelStop();
        this.isSetup = false;
        await super.stop();
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async channelStart(_data: Start): Promise<void> {
        this.codecState = CodecState.WAITING_FOR_CONFIG;
    }

    protected async setup(_data: Setup): Promise<void> {
        // TODO
    }

    protected async afterSetup(): Promise<void> {
        this.isSetup = true;
        this.ipcHandler.afterSetup();
    }

    protected async focus(data: VideoFocusRequestNotification): Promise<void> {
        this.ipcHandler.focusRequest({
            mode: data.mode,
            reason: data.reason,
        });
    }

    protected async channelStop(): Promise<void> {
        this.codecBuffer = undefined;
        this.codecState = CodecState.STOPPED;
        this.ipcHandler.stop();
    }

    protected parseH264CodecConfig(buffer: DataBuffer): VideoCodecConfig {
        const {
            profileIndex,
            constraintSet,
            levelIndex,
            cropLeft,
            cropRight,
            cropTop,
            cropBottom,
            croppedWidth,
            croppedHeight,
        } = h264ParseConfiguration(buffer.data);

        const codec = `avc1.${[profileIndex, constraintSet, levelIndex]
            .map(toHex)
            .join('')}`;

        return {
            codec,
            cropLeft,
            cropRight,
            cropTop,
            cropBottom,
            width: croppedWidth,
            height: croppedHeight,
        };
    }

    protected handleH264(buffer: DataBuffer): void {
        if (this.codecState === CodecState.STARTED) {
            this.ipcHandler.data(buffer.data);
        } else if (this.codecState === CodecState.WAITING_FOR_CONFIG) {
            assert(this.codecBuffer === undefined);

            let config;
            try {
                config = this.parseH264CodecConfig(buffer);
            } catch (err) {
                this.logger.error('Failed to parse H264 config', err);
                return;
            }

            this.ipcHandler.codecConfig(config);

            this.codecBuffer = buffer;
            this.codecState = CodecState.WAITING_FOR_FIRST_FRAME;
        } else if (this.codecState === CodecState.WAITING_FOR_FIRST_FRAME) {
            assert(this.codecBuffer !== undefined);

            if (!h264HasKeyFrame(buffer.data)) {
                this.logger.error('Failed to find H264 keyframe');
                return;
            }

            this.codecBuffer.appendBuffer(buffer);

            this.ipcHandler.firstFrame(this.codecBuffer.data);

            this.codecBuffer = undefined;
            this.codecState = CodecState.STARTED;
        } else {
            this.logger.error(
                `Cannot receive data in codec state ${
                    CodecState[this.codecState]
                }`,
            );
        }
    }

    protected async handleData(
        buffer: DataBuffer,
        _timestamp?: bigint,
    ): Promise<void> {
        const videoCodecType = this.videoConfigs[0].videoCodecType;
        assert(videoCodecType !== undefined);

        switch (videoCodecType) {
            case MediaCodecType.MEDIA_CODEC_VIDEO_H264_BP:
                this.handleH264(buffer);
                break;
            default:
                this.logger.error(
                    `Media codec ${MediaCodecType[videoCodecType]} unimplemented`,
                );
                return;
        }
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaSinkService = new MediaSinkService({
            videoConfigs: this.videoConfigs,
            displayId: 0,
            displayType: DisplayType.MAIN,
        });
    }
}
