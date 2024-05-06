import { AudioOutputService, type ServiceEvents } from '@web-auto/android-auto';
import { AudioStreamType } from '@web-auto/android-auto-proto';
import {
    stringToAudioStreamType,
    type IAudioConfiguration,
} from '@web-auto/android-auto-proto/interfaces.js';

export interface NodeAudioOutputServiceConfig {
    audioType: AudioStreamType | string;
    configs: IAudioConfiguration[];
}

export class NodeAudioOutputService extends AudioOutputService {
    public constructor(
        config: NodeAudioOutputServiceConfig,
        events: ServiceEvents,
    ) {
        super(
            {
                ...config,
                audioType: stringToAudioStreamType(config.audioType),
            },
            events,
        );
    }

    protected handleData(_buffer: Uint8Array, _timestamp?: bigint): void {}
}
