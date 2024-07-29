import assert from 'node:assert';

import {
    AudioStreamType,
    MediaCodecType,
    MediaSinkService,
    type Service,
} from '@web-auto/android-auto-proto';
import { type IAudioConfiguration } from '@web-auto/android-auto-proto/interfaces.js';

import { AVOutputService } from './AVOutputService.js';
import { type ServiceEvents } from './Service.js';

export interface AudioOutputServiceConfig {
    audioType: AudioStreamType;
    configs: IAudioConfiguration[];
}

export abstract class AudioOutputService extends AVOutputService {
    public constructor(
        protected config: AudioOutputServiceConfig,
        events: ServiceEvents,
    ) {
        super(
            {
                priorities: Array.from(config.configs.keys()),
            },
            events,
        );
    }

    protected channelConfig(): IAudioConfiguration {
        let index = this.configurationIndex;
        if (index === undefined && this.config.configs.length === 1) {
            index = 0;
        }

        assert(index !== undefined);
        const config = this.config.configs[index];
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

    protected override fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaSinkService = new MediaSinkService({
            availableType: MediaCodecType.MEDIA_CODEC_AUDIO_PCM,
            audioType: this.config.audioType,
            audioConfigs: this.config.configs,
        });
    }
}
