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
        } catch (err) {
            this.logger.error('Failed to handle data', {
                metadata: {
                    buffer,
                    err,
                },
            });
            return;
        }

        try {
            await this.sendAvMediaAckIndication();
        } catch (e) {
            this.logger.error('Failed to send ack', {
                metadata: e,
            });
        }
    }

    protected async onAvMediaWithTimestampIndication(
        payload: DataBuffer,
    ): Promise<void> {
        const timestamp = payload.readUint64BE();
        const buffer = payload.readBuffer();

        try {
            await this.handleData(buffer, timestamp);
        } catch (err) {
            this.logger.error('Failed to handle data', {
                metadata: {
                    buffer,
                    timestamp,
                    err,
                },
            });
            return;
        }

        try {
            await this.sendAvMediaAckIndication();
        } catch (e) {
            this.logger.error('Failed to send ack', {
                metadata: e,
            });
        }
    }

    protected async onStopIndication(
        data: AVChannelStopIndication,
    ): Promise<void> {
        try {
            await this.channelStop(data);
        } catch (err) {
            this.logger.error('Failed to stop channel', {
                metadata: {
                    data,
                    err,
                },
            });
        }
    }

    protected async onStartIndication(
        data: AVChannelStartIndication,
    ): Promise<void> {
        this.session = data.session;

        try {
            await this.channelStart(data);
        } catch (err) {
            this.logger.error('Failed to start channel', {
                metadata: {
                    data,
                    err,
                },
            });
        }
    }

    public async onSpecificMessage(message: Message): Promise<boolean> {
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
                return super.onSpecificMessage(message);
        }

        return true;
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
