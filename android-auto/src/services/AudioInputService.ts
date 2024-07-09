import { AVService } from './AVService.js';
import { microsecondsTime } from '../utils/time.js';
import { type ServiceEvents } from './Service.js';
import {
    Ack,
    MediaCodecType,
    MediaMessageId,
    MediaSourceService,
    MicrophoneRequest,
    MicrophoneResponse,
    Service,
} from '@web-auto/android-auto-proto';
import { BufferWriter } from '../utils/buffer.js';

export interface AudioInputServiceConfig {
    channelCount: number;
    sampleRate: number;
    numberOfBits: number;
}

export abstract class AudioInputService extends AVService {
    public constructor(
        protected config: AudioInputServiceConfig,
        events: ServiceEvents,
    ) {
        super(events);
    }

    protected abstract inputOpen(data: MicrophoneRequest): void;

    protected onInputOpenRequest(data: MicrophoneRequest): void {
        this.printReceive(data);

        try {
            this.inputOpen(data);
        } catch (err) {
            this.logger.error('Failed to open input', {
                data,
                err,
            });
            return;
        }

        this.sendInputOpenResponse();
    }

    protected onAckIndication(data: Ack): void {
        this.printReceive(data);
    }

    public override async onSpecificMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        let data;

        switch (messageId as MediaMessageId) {
            case MediaMessageId.MEDIA_MESSAGE_MICROPHONE_REQUEST:
                data = MicrophoneRequest.fromBinary(payload);
                this.onInputOpenRequest(data);
                break;
            case MediaMessageId.MEDIA_MESSAGE_ACK:
                data = Ack.fromBinary(payload);
                this.onAckIndication(data);
                break;
            default:
                return super.onSpecificMessage(messageId, payload);
        }

        return true;
    }

    protected sendInputOpenResponse(): void {
        if (this.session === undefined) {
            this.logger.error(
                'Cannot send input open response because session id is undefined',
            );
            return;
        }

        const data = new MicrophoneResponse({
            status: 0,
            sessionId: this.session,
        });

        this.sendEncryptedSpecificMessage(
            MediaMessageId.MEDIA_MESSAGE_MICROPHONE_RESPONSE,
            data,
        );
    }

    protected sendAvMediaWithTimestampIndication(buffer: Uint8Array): void {
        const writer = BufferWriter.fromSize(8 + buffer.byteLength);
        const timestamp = microsecondsTime();

        writer.appendUint64BE(timestamp);
        writer.appendBuffer(buffer);

        this.sendPayloadWithId(
            MediaMessageId.MEDIA_MESSAGE_DATA,
            writer.data,
            'Data',
            true,
            false,
        );
    }

    protected override fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaSourceService = new MediaSourceService({
            availableType: MediaCodecType.MEDIA_CODEC_AUDIO_PCM,
            audioConfig: {
                samplingRate: this.config.sampleRate,
                numberOfChannels: this.config.channelCount,
                numberOfBits: this.config.numberOfBits,
            },
        });
    }
}
