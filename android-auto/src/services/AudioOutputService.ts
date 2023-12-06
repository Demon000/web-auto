import {
    AudioConfiguration,
    AudioStreamType,
    MediaCodecType,
    MediaSinkService,
    type Service,
} from '@web-auto/android-auto-proto';
import { AVOutputService } from './AVOutputService.js';
import { type ServiceEvents } from './Service.js';

export abstract class AudioOutputService extends AVOutputService {
    public constructor(
        private audioType: AudioStreamType,
        protected events: ServiceEvents,
    ) {
        super(events);
    }

    protected channelConfig(): [number, number, number] {
        switch (this.audioType) {
            case AudioStreamType.AUDIO_STREAM_MEDIA:
                return [2, 48000, 2048];
            case AudioStreamType.AUDIO_STREAM_SYSTEM_AUDIO:
                return [1, 16000, 1024];
            case AudioStreamType.AUDIO_STREAM_GUIDANCE:
                return [1, 16000, 1024];
            default:
                throw new Error(`Unhandled audio type ${this.audioType}`);
        }
    }

    protected channelCount(): number {
        return this.channelConfig()[0];
    }

    protected sampleRate(): number {
        return this.channelConfig()[1];
    }

    protected chunkSize(): number {
        return this.channelConfig()[2];
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaSinkService = new MediaSinkService({
            availableType: MediaCodecType.MEDIA_CODEC_AUDIO_PCM,
            audioType: this.audioType,
            audioConfigs: [
                {
                    samplingRate: this.sampleRate(),
                    numberOfChannels: this.channelCount(),
                    numberOfBits: 16,
                },
            ],
        });
    }
}
