import {
    MediaMessageId,
    VideoFocusNotification,
    VideoFocusRequestNotification,
} from '@web-auto/android-auto-proto';

import { Message } from '../messenger/Message.js';

import { AVOutputService } from './AVOutputService.js';

export abstract class VideoService extends AVOutputService {
    public override async onSpecificMessage(
        message: Message,
    ): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId as MediaMessageId) {
            case MediaMessageId.MEDIA_MESSAGE_VIDEO_FOCUS_REQUEST:
                data = VideoFocusRequestNotification.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onVideoFocusRequest(data);
                break;
            default:
                return await super.onSpecificMessage(message);
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
}
