import { type ServiceEvents, VideoService } from '@web-auto/android-auto';
import type {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
    VideoCodecConfig,
} from '@web-auto/android-auto-ipc';
import {
    type Start,
    type VideoFocusRequestNotification,
    DisplayType,
    VideoFocusNotification,
    VideoFocusMode,
} from '@web-auto/android-auto-proto';
import assert from 'node:assert';
import type {
    IVideoConfiguration,
    IVideoFocusNotification,
} from '@web-auto/android-auto-proto/interfaces.js';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';
import { BufferWriter } from '@web-auto/android-auto';
import { hasKeyFrame, parseCodecConfig } from '../codec/index.js';

enum CodecState {
    STOPPED,
    WAITING_FOR_CONFIG,
    WAITING_FOR_FIRST_FRAME,
    STARTED,
}

export class NodeVideoService extends VideoService {
    private codecState = CodecState.STOPPED;
    private codecBuffer: Uint8Array | undefined;

    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoVideoService,
            AndroidAutoVideoClient
        >,
        videoConfigs: IVideoConfiguration[],
        displayId: number,
        displayType: DisplayType,
        priorities: number[],
        events: ServiceEvents,
    ) {
        super(videoConfigs, displayId, displayType, priorities, events);

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

    protected handleData(buffer: Uint8Array, _timestamp?: bigint): void {
        const channelConfig = this.channelConfig();
        const videoCodecType = channelConfig.videoCodecType;
        assert(videoCodecType !== undefined);

        if (this.codecState === CodecState.STARTED) {
            this.ipcHandler.data(buffer);
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
}
