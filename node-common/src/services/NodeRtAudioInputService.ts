import { type ServiceEvents } from '@web-auto/android-auto';
import {
    ChannelOpenRequest,
    MicrophoneRequest,
} from '@web-auto/android-auto-proto';
import RtAudioPackage from 'audify';

import {
    NodeAudioInputService,
    type NodeAudioInputServiceConfig,
} from './NodeAudioInputService.js';

const RTAUDIO_SINT16 = 2;
const { RtAudio } = RtAudioPackage;

export interface NodeRtAudioInputServiceConfig
    extends NodeAudioInputServiceConfig {
    chunkSize: number;
}

export class NodeRtAudioInputService extends NodeAudioInputService {
    private rtaudio;

    public constructor(
        protected override config: NodeRtAudioInputServiceConfig,
        events: ServiceEvents,
    ) {
        super(config, events);

        this.rtaudio = new RtAudio();
        this.session = 0;
    }

    protected override open(_data: ChannelOpenRequest): void {
        this.rtaudio.openStream(
            null,
            {
                nChannels: this.config.channelCount,
            },
            RTAUDIO_SINT16,
            this.config.sampleRate,
            this.config.chunkSize,
            this.constructor.name,
            (data) => {
                this.sendAvMediaWithTimestampIndication(data);
            },
            null,
        );
    }

    public override stop(): void {
        super.stop();
        this.rtaudio.closeStream();
    }

    protected override inputOpen(data: MicrophoneRequest): void {
        if (data.open) {
            this.rtaudio.start();
        } else {
            this.rtaudio.stop();
        }
    }
}
