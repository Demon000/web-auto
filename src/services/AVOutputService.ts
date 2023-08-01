import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import {
    AVChannelMessage,
    AVChannelStartIndication,
    AVChannelStopIndication,
    AVMediaAckIndication,
} from '../proto/types';
import { DataBuffer } from '../utils/DataBuffer';
import { AVService } from './AVService';

export abstract class AVOutputService extends AVService {
    protected session?: number;

    public constructor(
        channelId: ChannelId,
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(channelId, messageInStream, messageOutStream);
    }

    protected async onAvMediaIndication(buffer: DataBuffer): Promise<void> {
        try {
            await this.handleData(buffer);
        } catch (e) {
            console.log(e);
        }

        await this.sendAvMediaAckIndication();
    }

    protected async onAvMediaWithTimestampIndication(
        payload: DataBuffer,
    ): Promise<void> {
        console.log(payload);
        const timestamp = payload.readUint64BE();
        const buffer = payload.unreadSubarray();

        try {
            await this.handleData(buffer, timestamp);
        } catch (e) {
            console.log(e);
        }

        await this.sendAvMediaAckIndication();
    }

    protected async onStopIndication(
        data: AVChannelStopIndication,
    ): Promise<void> {
        try {
            await this.stop(data);
        } catch (e) {
            console.log(e);
        }
    }

    protected async onStartIndication(
        data: AVChannelStartIndication,
    ): Promise<void> {
        this.session = data.session;

        try {
            await this.start(data);
        } catch (e) {
            console.log(e);
        }
    }

    protected onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): boolean {
        const bufferPayload = message.getBufferPayload();
        const payload = message.getPayload();
        let data;

        switch (message.messageId) {
            case AVChannelMessage.Enum.AV_MEDIA_WITH_TIMESTAMP_INDICATION:
                this.onAvMediaWithTimestampIndication(payload);
                break;
            case AVChannelMessage.Enum.AV_MEDIA_INDICATION:
                this.onAvMediaIndication(payload);
                break;
            case AVChannelMessage.Enum.START_INDICATION:
                data = AVChannelStartIndication.decode(bufferPayload);
                this.printReceive(data);
                this.onStartIndication(data);
                break;
            case AVChannelMessage.Enum.STOP_INDICATION:
                data = AVChannelStopIndication.decode(bufferPayload);
                this.printReceive(data);
                this.onStopIndication(data);
                break;
            default:
                return super.onMessage(message, options);
        }

        return true;
    }

    protected abstract start(data: AVChannelStartIndication): Promise<void>;
    protected abstract stop(data: AVChannelStopIndication): Promise<void>;

    protected abstract handleData(
        buffer: DataBuffer,
        timestamp?: bigint,
    ): Promise<void>;

    protected async sendAvMediaAckIndication(): Promise<void> {
        if (this.session === undefined) {
            throw new Error('Received media indication without valid session');
        }

        const data = AVMediaAckIndication.create({
            session: this.session,
            value: 1,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            AVMediaAckIndication.encode(data).finish(),
        );

        return this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.AV_MEDIA_ACK_INDICATION,
            payload,
        );
    }
}
