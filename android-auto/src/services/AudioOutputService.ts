import {
    AudioStreamType,
    MediaCodecType,
    MediaSinkService,
    type Service,
} from '@web-auto/android-auto-proto';
import { AVOutputService } from './AVOutputService.js';
import { type ServiceEvents } from './Service.js';
import assert from 'node:assert';
import type { IAudioConfiguration } from '@web-auto/android-auto-proto/interfaces.js';

export abstract class AudioOutputService extends AVOutputService {
    public constructor(
        private audioType: AudioStreamType,
        private configs: IAudioConfiguration[],
        protected events: ServiceEvents,
    ) {
        super(events);
    }

    protected channelConfig(): IAudioConfiguration {
        assert(this.configurationIndex !== undefined);
        return this.configs[this.configurationIndex];
    }

    protected channelCount(): number {
        const channelCount = this.channelConfig().numberOfChannels;
        assert(channelCount !== undefined);
        return channelCount;
    }

    protected sampleRate(): number {
        const sampleRate = this.channelConfig().samplingRate;
        assert(sampleRate !== undefined);
        return sampleRate;
    }

    protected numberOfBits(): number {
        const numberOfBits = this.channelConfig().numberOfBits;
        assert(numberOfBits !== undefined);
        return numberOfBits;
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaSinkService = new MediaSinkService({
            availableType: MediaCodecType.MEDIA_CODEC_AUDIO_PCM,
            audioType: this.audioType,
            audioConfigs: this.configs,
        });
    }
}
