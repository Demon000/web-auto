import { BufferReader } from '../utils/buffer.js';
import { AVService } from './AVService.js';
import { type ServiceEvents } from './Service.js';
import { Ack, MediaMessageId, Start, Stop } from '@web-auto/android-auto-proto';

export abstract class AVOutputService extends AVService {
    protected configurationIndex: number | undefined;

    public constructor(priorities: number[], events: ServiceEvents) {
        super(priorities, events);
    }

    protected async onAvMediaIndication(buffer: Uint8Array): Promise<void> {
        try {
            this.handleData(buffer);
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
        const reader = BufferReader.fromBuffer(payload);
        const timestamp = reader.readUint64BE();
        const buffer = reader.readBuffer();

        try {
            this.handleData(buffer, timestamp);
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

    protected onStopIndication(data: Stop): void {
        try {
            this.channelStop();
        } catch (err) {
            this.logger.error('Failed to stop channel', {
                data,
                err,
            });
        }
    }

    protected onStartIndication(data: Start): void {
        this.session = data.sessionId;

        try {
            this.channelStart(data);
        } catch (err) {
            this.logger.error('Failed to start channel', {
                data,
                err,
            });
        }
    }

    public override async onSpecificMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        let data;

        switch (messageId as MediaMessageId) {
            case MediaMessageId.MEDIA_MESSAGE_DATA:
                this.printReceive('data');
                await this.onAvMediaWithTimestampIndication(payload);
                break;
            case MediaMessageId.MEDIA_MESSAGE_CODEC_CONFIG:
                this.printReceive('data');
                await this.onAvMediaIndication(payload);
                break;
            case MediaMessageId.MEDIA_MESSAGE_START:
                data = Start.fromBinary(payload);
                this.printReceive(data);
                this.onStartIndication(data);
                break;
            case MediaMessageId.MEDIA_MESSAGE_STOP:
                data = Stop.fromBinary(payload);
                this.printReceive(data);
                this.onStopIndication(data);
                break;
            default:
                return super.onSpecificMessage(messageId, payload);
        }

        return true;
    }

    public get channelStarted(): boolean {
        return this.configurationIndex !== undefined;
    }

    protected channelStart(data: Start): void {
        this.configurationIndex = data.configurationIndex;
    }

    protected channelStop(): void {
        this.configurationIndex = undefined;
    }

    protected abstract handleData(buffer: Uint8Array, timestamp?: bigint): void;

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
