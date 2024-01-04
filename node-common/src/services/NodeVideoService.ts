import { type ServiceEvents, VideoService } from '@web-auto/android-auto';
import type {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
    VideoCodecConfig,
} from '@web-auto/android-auto-ipc';
import {
    type Service,
    type Start,
    type VideoFocusRequestNotification,
    DisplayType,
    MediaSinkService,
    MediaCodecType,
    VideoFocusNotification,
    VideoFocusMode,
    KeyCode,
} from '@web-auto/android-auto-proto';
import assert from 'node:assert';
import type {
    IVideoConfiguration,
    IVideoFocusNotification,
} from '@web-auto/android-auto-proto/interfaces.js';
import {
    annexBSplitNalu,
    h264ParseConfiguration,
    h265ParseConfiguration,
    h265ParseNaluHeader,
} from '@yume-chan/scrcpy';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';
import { BufferWriter } from '@web-auto/android-auto';

enum CodecState {
    STOPPED,
    WAITING_FOR_CONFIG,
    WAITING_FOR_FIRST_FRAME,
    STARTED,
}

const toHex = (value: number) =>
    value.toString(16).padStart(2, '0').toUpperCase();

const toUint32Le = (data: Uint8Array, offset: number) => {
    return (
        data[offset]! |
        (data[offset + 1]! << 8) |
        (data[offset + 2]! << 16) |
        (data[offset + 3]! << 24)
    );
};

const h264HasKeyFrame = (buffer: Uint8Array) => {
    for (const nalu of annexBSplitNalu(buffer)) {
        const naluType = nalu[0]! & 0x1f;

        if (naluType === 5) {
            return true;
        }
    }

    return false;
};

const h265HasKeyFrame = (buffer: Uint8Array) => {
    for (const nalu of annexBSplitNalu(buffer)) {
        const header = h265ParseNaluHeader(nalu);

        if (header.nal_unit_type === 19 || header.nal_unit_type === 20) {
            return true;
        }
    }

    return false;
};

export class NodeVideoService extends VideoService {
    private codecState = CodecState.STOPPED;
    private codecBuffer: Uint8Array | undefined;

    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoVideoService,
            AndroidAutoVideoClient
        >,
        protected videoConfigs: IVideoConfiguration[],
        events: ServiceEvents,
    ) {
        super(events);

        ipcHandler.on(
            'sendVideoFocusNotification',
            this.sendVideoFocusNotificationObject.bind(this),
        );
        ipcHandler.on('getChannelStarted', this.getChannelStarted.bind(this));
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getChannelStarted(): Promise<boolean> {
        return this.channelStarted;
    }

    public async sendVideoFocusNotificationObject(
        data: IVideoFocusNotification,
    ): Promise<void> {
        await this.sendVideoFocusIndication(new VideoFocusNotification(data));
    }

    public override stop(): void {
        this.syncChannelStop();
        super.stop();
    }

    protected override async channelStart(data: Start): Promise<void> {
        await super.channelStart(data);
        this.codecState = CodecState.WAITING_FOR_CONFIG;

        assert(this.configurationIndex !== undefined);
        this.logger.info(
            'Selected configuration',
            this.videoConfigs[this.configurationIndex],
        );
        this.ipcHandler.channelStart();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async focus(data: VideoFocusRequestNotification): Promise<void> {
        this.ipcHandler.focusRequest({
            ...data,
        });
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected override async afterSetup(): Promise<void> {
        this.ipcHandler.focusRequest({
            mode: VideoFocusMode.VIDEO_FOCUS_PROJECTED,
        });
    }

    protected syncChannelStop(): void {
        this.codecBuffer = undefined;
        this.codecState = CodecState.STOPPED;
        this.ipcHandler.channelStop();
    }

    protected override async channelStop(): Promise<void> {
        await super.channelStop();
        this.syncChannelStop();
    }

    protected parseH264CodecConfig(buffer: Uint8Array): VideoCodecConfig {
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
        } = h264ParseConfiguration(buffer);

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

    protected parseH265CodecConfig(buffer: Uint8Array): VideoCodecConfig {
        const {
            generalProfileSpace,
            generalProfileIndex,
            generalProfileCompatibilitySet,
            generalTierFlag,
            generalLevelIndex,
            generalConstraintSet,
            cropLeft,
            cropRight,
            cropTop,
            cropBottom,
            croppedWidth,
            croppedHeight,
        } = h265ParseConfiguration(buffer);

        const codec = [
            'hev1',
            ['', 'A', 'B', 'C'][generalProfileSpace]! +
                generalProfileIndex.toString(),
            toUint32Le(generalProfileCompatibilitySet, 0).toString(16),
            (generalTierFlag ? 'H' : 'L') + generalLevelIndex.toString(),
            toUint32Le(generalConstraintSet, 0).toString(16).toUpperCase(),
            toUint32Le(generalConstraintSet, 4).toString(16).toUpperCase(),
        ].join('.');

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

    protected handleH264(buffer: Uint8Array): void {
        if (this.codecState === CodecState.STARTED) {
            this.ipcHandler.data(buffer);
        } else if (this.codecState === CodecState.WAITING_FOR_CONFIG) {
            assert(this.codecBuffer === undefined);

            let config;
            try {
                config = this.parseH264CodecConfig(buffer);
                this.logger.info('Parsed H264 config', config);
            } catch (err) {
                this.logger.error('Failed to parse H264 config', err);
                return;
            }

            this.ipcHandler.codecConfig(config);

            this.codecBuffer = buffer;
            this.codecState = CodecState.WAITING_FOR_FIRST_FRAME;
        } else if (this.codecState === CodecState.WAITING_FOR_FIRST_FRAME) {
            assert(this.codecBuffer !== undefined);

            if (!h264HasKeyFrame(buffer)) {
                this.logger.error('Failed to find H264 keyframe');
                return;
            }

            const firstFrameBuffer = BufferWriter.concat(
                this.codecBuffer,
                buffer,
            );
            this.ipcHandler.firstFrame(firstFrameBuffer);

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

    protected handleH265(buffer: Uint8Array): void {
        if (this.codecState === CodecState.STARTED) {
            this.ipcHandler.data(buffer);
        } else if (this.codecState === CodecState.WAITING_FOR_CONFIG) {
            assert(this.codecBuffer === undefined);

            let config;
            try {
                config = this.parseH265CodecConfig(buffer);
                this.logger.info('Parsed H265 config', config);
            } catch (err) {
                this.logger.error('Failed to parse H265 config', err);
                return;
            }

            this.ipcHandler.codecConfig(config);

            this.codecBuffer = buffer;
            this.codecState = CodecState.WAITING_FOR_FIRST_FRAME;
        } else if (this.codecState === CodecState.WAITING_FOR_FIRST_FRAME) {
            assert(this.codecBuffer !== undefined);

            if (!h265HasKeyFrame(buffer)) {
                this.logger.error('Failed to find H265 keyframe');
                return;
            }

            const firstFrameBuffer = BufferWriter.concat(
                this.codecBuffer,
                buffer,
            );
            this.ipcHandler.firstFrame(firstFrameBuffer);

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

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async handleData(
        buffer: Uint8Array,
        _timestamp?: bigint,
    ): Promise<void> {
        assert(this.configurationIndex !== undefined);
        const config = this.videoConfigs[this.configurationIndex];
        assert(config);

        const videoCodecType = config.videoCodecType;
        assert(videoCodecType !== undefined);

        switch (videoCodecType) {
            case MediaCodecType.MEDIA_CODEC_VIDEO_H264_BP:
                this.handleH264(buffer);
                break;
            case MediaCodecType.MEDIA_CODEC_VIDEO_H265:
                this.handleH265(buffer);
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

        if (this.displayType === DisplayType.AUXILIARY) {
            channelDescriptor.mediaSinkService.initialContentKeycode =
                KeyCode.KEYCODE_NAVIGATION;
        }
    }
}
