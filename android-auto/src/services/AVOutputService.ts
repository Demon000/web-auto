import assert from 'node:assert';
import { BufferReader } from '../utils/buffer.js';
import { AVService } from './AVService.js';
import { type ServiceEvents } from './Service.js';
import {
    Ack,
    Config,
    Config_Status,
    MediaMessageId,
    Start,
    Stop,
} from '@web-auto/android-auto-proto';

export interface AVOutputServiceConfig {
    priorities: number[];
}

export abstract class AVOutputService extends AVService {
    protected configurationIndex: number | undefined;
    protected sessionAckBuffer: Uint8Array | undefined;

    public constructor(
        private _config: AVOutputServiceConfig,
        events: ServiceEvents,
    ) {
        super(events);

        this.addMessageCallback(
            MediaMessageId.MEDIA_MESSAGE_DATA,
            this.onAvMediaWithTimestampIndication.bind(this),
        );
        this.addMessageCallback(
            MediaMessageId.MEDIA_MESSAGE_CODEC_CONFIG,
            this.onAvMediaIndication.bind(this),
        );
        this.addMessageCallback(
            MediaMessageId.MEDIA_MESSAGE_START,
            this.onStartIndication.bind(this),
            Start,
        );
        this.addMessageCallback(
            MediaMessageId.MEDIA_MESSAGE_STOP,
            this.onStopIndication.bind(this),
            Stop,
        );
    }

    protected override getConfig(status: boolean): Config {
        return new Config({
            maxUnacked: 1,
            status: status ? Config_Status.READY : Config_Status.WAIT,
            configurationIndices: this._config.priorities,
        });
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
