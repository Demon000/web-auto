import {
    AVChannelMessage,
    VideoFocusIndication,
    VideoFocusMode,
    VideoFocusRequest,
} from '@web-auto/android-auto-proto';

import { ChannelId } from '@/messenger/ChannelId';
import { Message } from '@/messenger/Message';
import { DataBuffer } from '@/utils/DataBuffer';

import { AVOutputService } from './AVOutputService';

export abstract class VideoService extends AVOutputService {
    public constructor() {
        super(ChannelId.VIDEO);
    }

    public async onMessage(message: Message): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case AVChannelMessage.Enum.VIDEO_FOCUS_REQUEST:
                data = VideoFocusRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onVideoFocusRequest(data);
                break;
            default:
                await super.onMessage(message);
        }
    }

    protected abstract focus(data: VideoFocusRequest): Promise<void>;

    protected async sendSetupResponse(status: boolean): Promise<void> {
        await super.sendSetupResponse(status);
        if (!status) {
            return;
        }

        await this.sendVideoFocusIndication();
    }

    protected async onVideoFocusRequest(
        data: VideoFocusRequest,
    ): Promise<void> {
        try {
            await this.focus(data);
        } catch (e) {
            console.log(e);
        }

        await this.sendVideoFocusIndication();
    }

    protected async sendVideoFocusIndication(): Promise<void> {
        const data = VideoFocusIndication.create({
            focusMode: VideoFocusMode.Enum.FOCUSED,
            unrequested: false,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            VideoFocusIndication.encode(data).finish(),
        );

        await this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.VIDEO_FOCUS_INDICATION,
            payload,
        );
    }
}
