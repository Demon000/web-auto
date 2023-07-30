import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import {
    AVChannel,
    AVChannelMessage,
    AVChannelSetupRequest,
    AVChannelSetupResponse,
    AVChannelSetupStatus,
    AVChannelStartIndication,
    AVChannelStopIndication,
    AVMediaAckIndication,
    AVStreamType,
    ChannelDescriptor,
    VideoFPS,
    VideoFocusIndication,
    VideoFocusMode,
    VideoFocusRequest,
    VideoResolution,
} from '../proto/types';
import { DataBuffer } from '../utils/DataBuffer';
import { Service } from './Service';

export abstract class VideoService extends Service {
    private session?: number;

    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.VIDEO, messageInStream, messageOutStream);
    }

    protected onMessage(message: Message): boolean {
        switch (message.messageId) {
            case AVChannelMessage.Enum.AV_MEDIA_WITH_TIMESTAMP_INDICATION:
                this.onAvMediaWithTimestampIndication(message);
                break;
            case AVChannelMessage.Enum.AV_MEDIA_INDICATION:
                this.onAvMediaIndication(message);
                break;
            case AVChannelMessage.Enum.SETUP_REQUEST:
                this.onSetupRequest(message);
                break;
            case AVChannelMessage.Enum.START_INDICATION:
                this.onStartIndication(message);
                break;
            case AVChannelMessage.Enum.STOP_INDICATION:
                this.onStopIndication(message);
                break;
            case AVChannelMessage.Enum.VIDEO_FOCUS_REQUEST:
                this.onVideoFocusRequest(message);
                break;
            default:
                return false;
        }

        return true;
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.avChannel = AVChannel.create({
            streamType: AVStreamType.Enum.VIDEO,
            availableWhileInCall: true,
            videoConfigs: [
                {
                    videoResolution: VideoResolution.Enum._1080p,
                    videoFps: VideoFPS.Enum._60,
                    marginHeight: 0,
                    marginWidth: 0,
                    dpi: 320,
                },
            ],
        });
    }

    protected abstract start(data: AVChannelStartIndication): Promise<void>;
    protected abstract setup(data: AVChannelSetupRequest): Promise<void>;
    protected abstract focus(data: VideoFocusRequest): Promise<void>;
    protected abstract stop(data: AVChannelStopIndication): Promise<void>;
    protected abstract handleData(
        buffer: DataBuffer,
        timestamp?: bigint,
    ): Promise<void>;

    protected async onAvMediaIndication(message: Message): Promise<void> {
        const buffer = message.getPayload();

        try {
            await this.handleData(buffer);
        } catch (e) {
            console.log(e);
        }

        await this.sendAvMediaAckIndication();
    }

    protected async onAvMediaWithTimestampIndication(
        message: Message,
    ): Promise<void> {
        const payload = message.getPayload();
        const timestamp = payload.readUint64BE();
        const buffer = payload.unreadSubarray();

        try {
            await this.handleData(buffer, timestamp);
        } catch (e) {
            console.log(e);
        }

        await this.sendAvMediaAckIndication();
    }

    protected async sendAvMediaAckIndication(): Promise<void> {
        if (this.session === undefined) {
            throw new Error('Received media indication without valid session');
        }

        const data = AVMediaAckIndication.create({
            session: this.session,
            value: 1,
        });

        const payload = DataBuffer.fromBuffer(
            AVMediaAckIndication.encode(data).finish(),
        );

        return this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.AV_MEDIA_ACK_INDICATION,
            payload,
        );
    }

    protected async onVideoFocusRequest(message: Message): Promise<void> {
        const data = VideoFocusRequest.decode(message.getBufferPayload());

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

        const payload = DataBuffer.fromBuffer(
            VideoFocusIndication.encode(data).finish(),
        );

        return this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.VIDEO_FOCUS_INDICATION,
            payload,
        );
    }

    protected async onStopIndication(message: Message): Promise<void> {
        const data = AVChannelStopIndication.decode(message.getBufferPayload());
        try {
            await this.stop(data);
        } catch (e) {
            console.log(e);
        }
    }

    protected async onStartIndication(message: Message): Promise<void> {
        const data = AVChannelStartIndication.decode(
            message.getBufferPayload(),
        );
        this.session = data.session;

        try {
            await this.start(data);
        } catch (e) {
            console.log(e);
        }
    }

    protected async onSetupRequest(message: Message): Promise<void> {
        const data = AVChannelSetupRequest.decode(message.getBufferPayload());
        let status = false;

        try {
            await this.setup(data);
            status = true;
        } catch (e) {
            console.log(e);
        }

        return this.sendSetupResponse(status);
    }

    protected async sendSetupResponse(status: boolean): Promise<void> {
        const data = AVChannelSetupResponse.create({
            maxUnacked: 1,
            mediaStatus: status
                ? AVChannelSetupStatus.Enum.OK
                : AVChannelSetupStatus.Enum.FAIL,
        });

        const payload = DataBuffer.fromBuffer(
            AVChannelSetupResponse.encode(data).finish(),
        );

        return this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.SETUP_RESPONSE,
            payload,
        );
    }
}
