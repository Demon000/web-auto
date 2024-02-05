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
        priorities: number[],
        events: ServiceEvents,
    ) {
        super(priorities, events);
    }

    protected channelConfig(): IAudioConfiguration {
        let index = this.configurationIndex;
        if (index === undefined && this.configs.length === 1) {
            index = 0;
        }

        assert(index !== undefined);
        const config = this.configs[index];
        assert(config !== undefined);
        return config;
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
