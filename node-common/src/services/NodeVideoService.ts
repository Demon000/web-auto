import { type ServiceEvents, VideoService } from '@web-auto/android-auto';
import type {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
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

    public async sendVideoFocusNotificationObject(
        data: IVideoFocusNotification,
    ): Promise<void> {
        await this.sendVideoFocusIndication(new VideoFocusNotification(data));
    }

    public override stop(): void {
        this.channelStop();
        super.stop();
    }

    protected override channelStart(data: Start): void {
        super.channelStart(data);

        const config = this.channelConfig();
        this.codecState = CodecState.WAITING_FOR_CONFIG;
        this.logger.info('Selected configuration', config);
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

    protected override channelStop(): void {
        super.channelStop();
        this.codecBuffer = undefined;
        this.codecState = CodecState.STOPPED;
        this.ipcHandler.channelStop();
    }

    protected handleData(buffer: Uint8Array, _timestamp?: bigint): void {
        const config = this.channelConfig();
        const videoCodecType = config.videoCodecType;
        assert(videoCodecType !== undefined);

        if (this.codecState === CodecState.STARTED) {
            this.ipcHandler.data(buffer);
        } else if (this.codecState === CodecState.WAITING_FOR_CONFIG) {
            assert(this.codecBuffer === undefined);

            let config;
            try {
                config = parseCodecConfig(videoCodecType, buffer);
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
