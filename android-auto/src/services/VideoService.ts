import assert from 'node:assert';

import {
    DisplayType,
    KeyCode,
    MediaMessageId,
    MediaSinkService,
    Service,
    VideoFocusNotification,
    VideoFocusRequestNotification,
} from '@web-auto/android-auto-proto';
import { type IVideoConfiguration } from '@web-auto/android-auto-proto/interfaces.js';

import { AVOutputService } from './AVOutputService.js';
import type { ServiceEvents } from './Service.js';
import {
    type DisplayConfig,
    type ResolutionConfig,
    VideoResolutionUtils,
} from './VideoResolutionUtils.js';

export interface VideoServiceConfig {
    id: number;
    type: DisplayType;
    display: DisplayConfig;
    resolutions: ResolutionConfig[];
}

export abstract class VideoService extends AVOutputService {
    protected configs: IVideoConfiguration[];

    public constructor(
        protected config: VideoServiceConfig,
        events: ServiceEvents,
    ) {
        const configs = VideoResolutionUtils.getVideoConfigs(
            config.display,
            config.resolutions,
        );

        super(
            {
                priorities: Array.from(configs.keys()),
            },
            events,
        );

        this.configs = configs;

        this.addMessageCallback(
            MediaMessageId.MEDIA_MESSAGE_VIDEO_FOCUS_REQUEST,
            this.onVideoFocusRequest.bind(this),
            VideoFocusRequestNotification,
        );
    }

    protected channelConfig(): IVideoConfiguration {
        assert(this.configurationIndex !== undefined);
        const config = this.configs[this.configurationIndex];
        assert(config !== undefined);
        return config;
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

    protected sendVideoFocusIndication(data: VideoFocusNotification): void {
        this.sendEncryptedSpecificMessage(
            MediaMessageId.MEDIA_MESSAGE_VIDEO_FOCUS_NOTIFICATION,
            data,
        );
    }

    protected override fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaSinkService = new MediaSinkService({
            videoConfigs: this.configs,
            displayId: this.config.id,
            displayType: this.config.type,
        });

        if (this.config.type === DisplayType.AUXILIARY) {
            channelDescriptor.mediaSinkService.initialContentKeycode =
                KeyCode.KEYCODE_NAVIGATION;
        }
    }
}
