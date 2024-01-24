import assert from 'node:assert';
import { BufferReader } from '../utils/buffer.js';
import { AVService } from './AVService.js';
import { type ServiceEvents } from './Service.js';
import { Ack, MediaMessageId, Start, Stop } from '@web-auto/android-auto-proto';

export abstract class AVOutputService extends AVService {
    protected configurationIndex: number | undefined;
    protected sessionAckBuffer: Uint8Array | undefined;

    public constructor(priorities: number[], events: ServiceEvents) {
        super(priorities, events);
    }

    protected onAvMediaIndication(buffer: Uint8Array): void {
        this.handleData(buffer);

        this.sendAvMediaAckIndication();
    }

    protected onAvMediaWithTimestampIndication(payload: Uint8Array): void {
        const reader = BufferReader.fromBuffer(payload);
        const timestamp = reader.readUint64BE();
        const buffer = reader.readBuffer();

        this.handleData(buffer, timestamp);

        this.sendAvMediaAckIndication();
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
        assert(data.sessionId !== undefined);
        this.session = data.sessionId;
        this.sessionAckBuffer = new Ack({
            sessionId: this.session,
            ack: 1,
        }).toBinary();

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
                this.onAvMediaWithTimestampIndication(payload);
                break;
            case MediaMessageId.MEDIA_MESSAGE_CODEC_CONFIG:
                this.printReceive('data');
                this.onAvMediaIndication(payload);
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

    protected sendAvMediaAckIndication(): void {
        assert(this.sessionAckBuffer !== undefined);
        this.sendPayloadWithId(
            MediaMessageId.MEDIA_MESSAGE_ACK,
            this.sessionAckBuffer,
            'Ack',
            true,
            false,
        );
    }
}
