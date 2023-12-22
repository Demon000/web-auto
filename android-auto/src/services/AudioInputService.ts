import { Message } from '../messenger/Message.js';
import { DataBuffer } from '../utils/DataBuffer.js';
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

export abstract class AudioInputService extends AVService {
    public constructor(protected events: ServiceEvents) {
        super(events);
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

    protected abstract inputOpen(data: MicrophoneRequest): Promise<void>;

    protected async onInputOpenRequest(data: MicrophoneRequest): Promise<void> {
        try {
            await this.inputOpen(data);
        } catch (err) {
            this.logger.error('Failed to open input', {
                data,
                err,
            });
            return;
        }

        await this.sendInputOpenResponse();
    }

    protected async onAckIndication(_data: Ack): Promise<void> {}

    public async onSpecificMessage(message: Message): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId as MediaMessageId) {
            case MediaMessageId.MEDIA_MESSAGE_MICROPHONE_REQUEST:
                data = MicrophoneRequest.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onInputOpenRequest(data);
                break;
            case MediaMessageId.MEDIA_MESSAGE_ACK:
                data = Ack.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onAckIndication(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
    }

    protected async sendInputOpenResponse(): Promise<void> {
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

        await this.sendEncryptedSpecificMessage(
            MediaMessageId.MEDIA_MESSAGE_MICROPHONE_RESPONSE,
            data,
        );
    }

    protected async sendAvMediaWithTimestampIndication(
        buffer: DataBuffer,
    ): Promise<void> {
        const payload = DataBuffer.empty();
        const timestamp = microsecondsTime();

        payload.appendUint64BE(timestamp);
        payload.appendBuffer(buffer);

        await this.sendPayloadWithId(
            MediaMessageId.MEDIA_MESSAGE_DATA,
            payload,
            'data',
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
