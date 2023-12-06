import {
    MediaMessageId,
    VideoFocusMode,
    VideoFocusNotification,
    VideoFocusRequestNotification,
} from '@web-auto/android-auto-proto';

import { Message } from '../messenger/Message.js';
import { DataBuffer } from '../utils/DataBuffer.js';

import { AVOutputService } from './AVOutputService.js';

export abstract class VideoService extends AVOutputService {
    public async onSpecificMessage(message: Message): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
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

    protected async sendSetupResponse(status: boolean): Promise<void> {
        await super.sendSetupResponse(status);
        if (!status) {
            return;
        }

        await this.sendVideoFocusIndication();
    }

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

        await this.sendVideoFocusIndication();
    }

    protected async sendVideoFocusIndication(): Promise<void> {
        const data = new VideoFocusNotification({
            focus: VideoFocusMode.VIDEO_FOCUS_PROJECTED,
            unsolicited: false,
        });

        this.printSend(data);

        const payload = DataBuffer.fromBuffer(data.toBinary());

        await this.sendEncryptedSpecificMessage(
            MediaMessageId.MEDIA_MESSAGE_VIDEO_FOCUS_NOTIFICATION,
            payload,
        );
    }
}
