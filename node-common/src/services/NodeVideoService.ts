import { type ServiceEvents, VideoService } from '@web-auto/android-auto';
import {
    type Start,
    VideoFocusRequestNotification,
    VideoFocusNotification,
    VideoFocusMode,
    DisplayType,
    MediaCodecType,
    VideoCodecResolutionType,
    VideoFrameRateType,
} from '@web-auto/android-auto-proto';
import assert from 'node:assert';
import {
    stringToCodec,
    stringToDisplayType,
    stringToFramerate,
    stringToResolution,
    type IInsets,
    type IVideoConfiguration,
    type IVideoFocusNotification,
    type IVideoFocusRequestNotification,
} from '@web-auto/android-auto-proto/interfaces.js';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';
import { BufferWriter } from '@web-auto/android-auto';
import { hasKeyFrame, parseCodecConfig } from '../codec/index.js';
import type { DisplayConfig, ResolutionConfig } from '@web-auto/android-auto';

enum CodecState {
    STOPPED,
    WAITING_FOR_CONFIG,
    WAITING_FOR_FIRST_FRAME,
    STARTED,
}

export type VideoCodecConfig = {
    croppedWidth: number;
    croppedHeight: number;
    width: number;
    height: number;
    margins: IInsets;
    codec: string;
};

export type AndroidAutoVideoService = {
    sendVideoFocusNotification(data: IVideoFocusNotification): Promise<void>;
    getChannelStarted(): Promise<boolean>;
};

export type AndroidAutoVideoClient = {
    focusRequest(data: IVideoFocusRequestNotification): void;
    codecConfig(config: VideoCodecConfig): void;
    firstFrame(buffer: Uint8Array, timestamp?: bigint): void;
    channelStart(): void;
    channelStop(): void;
    data(buffer: Uint8Array, timestamp?: bigint): void;
};

export type VideoServiceResolutionConfig = {
    resolution: string | VideoCodecResolutionType;
    codec: string | MediaCodecType;
    framerate: string | number | VideoFrameRateType;
};

export interface NodeVideoServiceConfig {
    id: number;
    type: DisplayType | string;
    display: DisplayConfig;
    resolutions: VideoServiceResolutionConfig[];
}

const resolutionConfigToResolution = (
    value: VideoServiceResolutionConfig,
): ResolutionConfig => {
    const resolution = stringToResolution(value.resolution);
    const codec = stringToCodec(value.codec);
    const framerate = stringToFramerate(value.framerate);

    return {
        resolution,
        codec,
        framerate,
    };
};

export class NodeVideoService extends VideoService {
    private codecState = CodecState.STOPPED;
    private codecBuffer: Uint8Array | undefined;

    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoVideoService,
            AndroidAutoVideoClient
        >,
        config: NodeVideoServiceConfig,
        events: ServiceEvents,
    ) {
        super(
            {
                ...config,
                resolutions: config.resolutions.map(
                    resolutionConfigToResolution,
                ),
                type: stringToDisplayType(config.type),
            },
            events,
        );

        ipcHandler.on(
            'sendVideoFocusNotification',
            this.sendVideoFocusNotificationObject.bind(this),
        );
        ipcHandler.on('getChannelStarted', this.getChannelStarted.bind(this));
        ipcHandler.onNoClients(
            'channelStart',
            this.onNoChannelStartClients.bind(this),
        );
    }

    public override destroy(): void {
        this.ipcHandler.offNoClients('channelStart');
        this.ipcHandler.off('sendVideoFocusNotification');
        this.ipcHandler.off('getChannelStarted');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getChannelStarted(): Promise<boolean> {
        return this.channelStarted;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async sendVideoFocusNotificationObject(
        data: IVideoFocusNotification,
    ): Promise<void> {
        this.sendVideoFocusIndication(new VideoFocusNotification(data));
    }

    public override stop(): void {
        this.channelStop();
        super.stop();
    }

    protected override channelStart(data: Start): void {
        super.channelStart(data);

        const channelConfig = this.channelConfig();
        this.codecState = CodecState.WAITING_FOR_CONFIG;
        this.logger.info('Selected configuration', channelConfig);
        this.ipcHandler.channelStart();
    }

    private onNoChannelStartClients(): void {
        this.sendVideoFocusNotificationObject(
            new VideoFocusNotification({
                focus: VideoFocusMode.VIDEO_FOCUS_NATIVE,
                unsolicited: true,
            }),
        )
            .then(() => {})
            .catch((err) => {
                this.logger.error(
                    'Failed to send native focus notification on no clients',
                    err,
                );
            });
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async focus(data: VideoFocusRequestNotification): Promise<void> {
        this.ipcHandler.focusRequest({
            ...data,
        });
    }

    protected override afterSetup(): void {
        this.ipcHandler.focusRequest({
            mode: VideoFocusMode.VIDEO_FOCUS_PROJECTED,
        });
    }

    protected override channelStop(): void {
        super.channelStop();
        this.codecBuffer = undefined;
        this.codecState = CodecState.STOPPED;
        this.ipcHandler.channelStop();
    }

    protected parseCodecConfig(
        channelConfig: IVideoConfiguration,
        buffer: Uint8Array,
    ): VideoCodecConfig {
        const videoCodecType = channelConfig.videoCodecType;
        assert(videoCodecType !== undefined);

        const codecConfig = parseCodecConfig(videoCodecType, buffer);

        let margins = {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
        };

        const width = codecConfig.croppedWidth;
        const height = codecConfig.croppedHeight;
        let croppedWidth = codecConfig.croppedWidth;
        let croppedHeight = codecConfig.croppedHeight;

        const uiConfigMargins = channelConfig.uiConfig?.margins;
        const widthMargin = channelConfig.widthMargin;
        const heightMargin = channelConfig.heightMargin;

        let top;
        let bottom;
        let left;
        let right;

        if (uiConfigMargins !== undefined) {
            ({ top, bottom, left, right } = uiConfigMargins);
        } else if (widthMargin !== undefined && heightMargin !== undefined) {
            top = Math.round(heightMargin / 2);
            bottom = heightMargin - top;
            left = Math.round(widthMargin / 2);
            right = widthMargin - left;
        }

        if (top === undefined) {
            top = 0;
        }

        if (bottom === undefined) {
            bottom = 0;
        }

        if (left === undefined) {
            left = 0;
        }

        if (right === undefined) {
            right = 0;
        }

        margins = {
            top,
            bottom,
            left,
            right,
        };

        croppedHeight = height - top - bottom;
        croppedWidth = width - left - right;

        return {
            codec: codecConfig.codec,
            margins,
            croppedHeight,
            croppedWidth,
            width,
            height,
        };
    }

    protected override handleData(
        buffer: Uint8Array,
        timestamp?: bigint,
    ): void {
        const channelConfig = this.channelConfig();
        const videoCodecType = channelConfig.videoCodecType;
        assert(videoCodecType !== undefined);

        if (this.codecState === CodecState.STARTED) {
            this.ipcHandler.sendRaw('data', buffer, timestamp);
        } else if (this.codecState === CodecState.WAITING_FOR_CONFIG) {
            assert(this.codecBuffer === undefined);

            let config;
            try {
                config = this.parseCodecConfig(channelConfig, buffer);
                this.logger.info('Parsed config', config);
            } catch (err) {
                this.logger.error('Failed to parse config', err);
                return;
            }

            this.ipcHandler.codecConfig(config);

            this.codecBuffer = buffer;
            this.codecState = CodecState.WAITING_FOR_FIRST_FRAME;
        } else if (this.codecState === CodecState.WAITING_FOR_FIRST_FRAME) {
            assert(this.codecBuffer !== undefined);

            if (!hasKeyFrame(videoCodecType, buffer)) {
                this.logger.error('Failed to find keyframe');
                return;
            }

            const firstFrameBuffer = BufferWriter.concat(
                this.codecBuffer,
                buffer,
            );
            this.ipcHandler.sendRaw('firstFrame', firstFrameBuffer, timestamp);

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
}
