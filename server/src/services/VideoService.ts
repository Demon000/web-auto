import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import {
    AVChannelMessage,
    VideoFocusIndication,
    VideoFocusMode,
    VideoFocusRequest,
} from '../proto/types';
import { DataBuffer } from '../utils/DataBuffer';
import { AVOutputService } from './AVOutputService';

export abstract class VideoService extends AVOutputService {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.VIDEO, messageInStream, messageOutStream);
    }

    protected onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): boolean {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case AVChannelMessage.Enum.VIDEO_FOCUS_REQUEST:
                data = VideoFocusRequest.decode(bufferPayload);
                this.printReceive(data);
                this.onVideoFocusRequest(data);
                break;
            default:
                return super.onMessage(message, options);
        }

        return true;
    }

    protected abstract focus(data: VideoFocusRequest): Promise<void>;

    protected async sendSetupResponse(status: boolean): Promise<void> {
        await super.sendSetupResponse(status);
        if (!status) {
            return;
        }

        this.sendVideoFocusIndication();
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

        return this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.VIDEO_FOCUS_INDICATION,
            payload,
        );
    }
}
