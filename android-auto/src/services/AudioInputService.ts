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

export abstract class AudioInputService extends AVService {
    public constructor(events: ServiceEvents) {
        super([0], events);
    }

    protected channelCount(): number {
        return 1;
    }

    protected sampleRate(): number {
        return 16000;
    }

    protected chunkSize(): number {
        return 2048;
    }

    protected abstract inputOpen(data: MicrophoneRequest): void;

    protected onInputOpenRequest(data: MicrophoneRequest): void {
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

    protected async onAckIndication(_data: Ack): Promise<void> {}

    public override async onSpecificMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        let data;

        switch (messageId as MediaMessageId) {
            case MediaMessageId.MEDIA_MESSAGE_MICROPHONE_REQUEST:
                data = MicrophoneRequest.fromBinary(payload);
                this.printReceive(data);
                this.onInputOpenRequest(data);
                break;
            case MediaMessageId.MEDIA_MESSAGE_ACK:
                data = Ack.fromBinary(payload);
                this.printReceive(data);
                await this.onAckIndication(data);
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

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaSourceService = new MediaSourceService({
            availableType: MediaCodecType.MEDIA_CODEC_AUDIO_PCM,
            audioConfig: {
                samplingRate: this.sampleRate(),
                numberOfChannels: this.channelCount(),
                numberOfBits: 16,
            },
        });
    }
}
