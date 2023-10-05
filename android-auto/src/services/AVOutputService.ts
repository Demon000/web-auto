import { ChannelId } from '@/messenger/ChannelId';
import { Message } from '@/messenger/Message';
import {
    AVChannelMessage,
    AVChannelStartIndication,
    AVChannelStopIndication,
    AVMediaAckIndication,
} from '@web-auto/android-auto-proto';
import { DataBuffer } from '@/utils/DataBuffer';
import { AVService } from './AVService';
import Long from 'long';

export abstract class AVOutputService extends AVService {
    public constructor(channelId: ChannelId) {
        super(channelId);
    }

    protected async onAvMediaIndication(buffer: DataBuffer): Promise<void> {
        try {
            await this.handleData(buffer);
        } catch (e) {
            this.logger.error(e);
            return;
        }

        try {
            await this.sendAvMediaAckIndication();
        } catch (e) {
            this.logger.error(e);
        }
    }

    protected async onAvMediaWithTimestampIndication(
        payload: DataBuffer,
    ): Promise<void> {
        const timestamp = payload.readUint64BE();
        const buffer = payload.readBuffer();

        try {
            await this.handleData(buffer, timestamp);
        } catch (e) {
            this.logger.error(e);
            return;
        }

        try {
            await this.sendAvMediaAckIndication();
        } catch (e) {
            this.logger.error(e);
        }
    }

    protected async onStopIndication(
        data: AVChannelStopIndication,
    ): Promise<void> {
        try {
            await this.channelStop(data);
        } catch (e) {
            this.logger.error(e);
        }
    }

    protected async onStartIndication(
        data: AVChannelStartIndication,
    ): Promise<void> {
        this.session = data.session;

        try {
            await this.channelStart(data);
        } catch (e) {
            this.logger.error(e);
        }
    }

    public async onMessage(message: Message): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        const payload = message.getPayload();
        let data;

        switch (message.messageId) {
            case AVChannelMessage.Enum.AV_MEDIA_WITH_TIMESTAMP_INDICATION:
                this.printReceive('data');
                await this.onAvMediaWithTimestampIndication(payload);
                break;
            case AVChannelMessage.Enum.AV_MEDIA_INDICATION:
                this.printReceive('data');
                await this.onAvMediaIndication(payload);
                break;
            case AVChannelMessage.Enum.START_INDICATION:
                data = AVChannelStartIndication.decode(bufferPayload);
                this.printReceive(data);
                await this.onStartIndication(data);
                break;
            case AVChannelMessage.Enum.STOP_INDICATION:
                data = AVChannelStopIndication.decode(bufferPayload);
                this.printReceive(data);
                await this.onStopIndication(data);
                break;
            default:
                await super.onMessage(message);
        }
    }

    protected abstract channelStart(
        data: AVChannelStartIndication,
    ): Promise<void>;
    protected abstract channelStop(
        data: AVChannelStopIndication,
    ): Promise<void>;
    protected abstract handleData(
        buffer: DataBuffer,
        timestamp?: Long,
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

        await this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.AV_MEDIA_ACK_INDICATION,
            payload,
        );
    }
}
