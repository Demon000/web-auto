import {
    DisplayType,
    KeyCode,
    MediaMessageId,
    MediaSinkService,
    Service,
    VideoFocusNotification,
    VideoFocusRequestNotification,
} from '@web-auto/android-auto-proto';

import { AVOutputService } from './AVOutputService.js';
import type { IVideoConfiguration } from '@web-auto/android-auto-proto/interfaces.js';
import type { ServiceEvents } from './Service.js';
import assert from 'node:assert';

export abstract class VideoService extends AVOutputService {
    public constructor(
        protected configs: IVideoConfiguration[],
        protected displayId: number,
        protected displayType: DisplayType,
        priorities: number[],
        events: ServiceEvents,
    ) {
        super(priorities, events);
    }

    protected channelConfig(): IVideoConfiguration {
        assert(this.configurationIndex !== undefined);
        const config = this.configs[this.configurationIndex];
        assert(config !== undefined);
        return config;
    }

    public override async onSpecificMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        let data;

        switch (messageId as MediaMessageId) {
            case MediaMessageId.MEDIA_MESSAGE_VIDEO_FOCUS_REQUEST:
                data = VideoFocusRequestNotification.fromBinary(payload);
                this.printReceive(data);
                await this.onVideoFocusRequest(data);
                break;
            default:
                return await super.onSpecificMessage(messageId, payload);
        }

        return true;
    }

    protected abstract focus(
        data: VideoFocusRequestNotification,
    ): Promise<void>;

    protected async onVideoFocusRequest(
        data: VideoFocusRequestNotification,
    ): Promise<void> {
        try {
            await this.focus(data);
        } catch (err) {
            this.logger.error('Failed to focus video', {
                data,
                err,
            });
            return;
        }
    }

    protected async sendVideoFocusIndication(
        data: VideoFocusNotification,
    ): Promise<void> {
        await this.sendEncryptedSpecificMessage(
            MediaMessageId.MEDIA_MESSAGE_VIDEO_FOCUS_NOTIFICATION,
            data,
        );
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaSinkService = new MediaSinkService({
            videoConfigs: this.configs,
            displayId: this.displayId,
            displayType: this.displayType,
        });

        if (this.displayType === DisplayType.AUXILIARY) {
            channelDescriptor.mediaSinkService.initialContentKeycode =
                KeyCode.KEYCODE_NAVIGATION;
        }
    }
}
