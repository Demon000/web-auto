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
import { microsecondsTime } from '../utils/time.js';
import { AVService } from './AVService.js';
import { type ServiceEvents } from './Service.js';

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

        this.addMessageCallback(
            MediaMessageId.MEDIA_MESSAGE_MICROPHONE_REQUEST,
            this.onInputOpenRequest.bind(this),
            MicrophoneRequest,
        );
        this.addMessageCallback(
            MediaMessageId.MEDIA_MESSAGE_ACK,
            this.onAckIndication.bind(this),
            Ack,
        );
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

    protected onAckIndication(_data: Ack): void {}

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
