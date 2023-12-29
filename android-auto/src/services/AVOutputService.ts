import { Message } from '../messenger/Message.js';
import { AVService } from './AVService.js';
import { type ServiceEvents } from './Service.js';
import { Ack, MediaMessageId, Start, Stop } from '@web-auto/android-auto-proto';

export abstract class AVOutputService extends AVService {
    protected configurationIndex: number | undefined;

    public constructor(events: ServiceEvents) {
        super(events);
    }

    protected async onAvMediaIndication(buffer: Uint8Array): Promise<void> {
        try {
            await this.handleData(buffer);
        } catch (err) {
            this.logger.error('Failed to handle data', {
                buffer,
                err,
            });
            return;
        }

        try {
            await this.sendAvMediaAckIndication();
        } catch (err) {
            this.logger.error('Failed to send ack', err);
        }
    }

    protected async onAvMediaWithTimestampIndication(
        payload: Uint8Array,
    ): Promise<void> {
        const timestamp = payload.readUint64BE();
        const buffer = payload.readBuffer();

        try {
            await this.handleData(buffer, timestamp);
        } catch (err) {
            this.logger.error('Failed to handle data', {
                buffer,
                timestamp,
                err,
            });
            return;
        }

        try {
            await this.sendAvMediaAckIndication();
        } catch (err) {
            this.logger.error('Failed to send ack', err);
        }
    }

    protected async onStopIndication(data: Stop): Promise<void> {
        try {
            await this.channelStop();
        } catch (err) {
            this.logger.error('Failed to stop channel', {
                data,
                err,
            });
        }
    }

    protected async onStartIndication(data: Start): Promise<void> {
        this.session = data.sessionId;

        try {
            await this.channelStart(data);
        } catch (err) {
            this.logger.error('Failed to start channel', {
                data,
                err,
            });
        }
    }

    public override async onSpecificMessage(
        message: Message,
    ): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        const payload = message.getPayload();
        let data;

        switch (message.messageId as MediaMessageId) {
            case MediaMessageId.MEDIA_MESSAGE_DATA:
                this.printReceive('data');
                await this.onAvMediaWithTimestampIndication(payload);
                break;
            case MediaMessageId.MEDIA_MESSAGE_CODEC_CONFIG:
                this.printReceive('data');
                await this.onAvMediaIndication(payload);
                break;
            case MediaMessageId.MEDIA_MESSAGE_START:
                data = Start.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onStartIndication(data);
                break;
            case MediaMessageId.MEDIA_MESSAGE_STOP:
                data = Stop.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onStopIndication(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
    }

    public get channelStarted(): boolean {
        return this.configurationIndex !== undefined;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async channelStart(data: Start): Promise<void> {
        this.configurationIndex = data.configurationIndex;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async channelStop(): Promise<void> {
        this.configurationIndex = undefined;
    }

    protected abstract handleData(
        buffer: Uint8Array,
        timestamp?: bigint,
    ): Promise<void>;

    protected async sendAvMediaAckIndication(): Promise<void> {
        if (this.session === undefined) {
            throw new Error('Received media indication without valid session');
        }

        const data = new Ack({
            sessionId: this.session,
            ack: 1,
        });

        await this.sendEncryptedSpecificMessage(
            MediaMessageId.MEDIA_MESSAGE_ACK,
            data,
        );
    }
}
