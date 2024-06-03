import { type ServiceEvents } from '@web-auto/android-auto';
import {
    AudioStreamType,
    ChannelOpenRequest,
    Start,
} from '@web-auto/android-auto-proto';
import {
    stringToAudioStreamType,
    type IAudioConfiguration,
} from '@web-auto/android-auto-proto/interfaces.js';
import RtAudioPackage from 'audify';
import assert from 'node:assert';
import { bufferWrapUint8Array } from '@web-auto/android-auto';
import { NodeAudioOutputService } from './NodeAudioOutputService.js';

const { RtAudio } = RtAudioPackage;

enum RtAudioFormat {
    /** 8-bit signed integer. */
    RTAUDIO_SINT8 = 0x1,

    /** 16-bit signed integer. */
    RTAUDIO_SINT16 = 0x2,

    /** 24-bit signed integer - Removed. */
    RTAUDIO_SINT24 = 0x4,

    /** 32-bit signed integer. */
    RTAUDIO_SINT32 = 0x8,

    /** Normalized between plus/minus 1.0. */
    RTAUDIO_FLOAT32 = 0x10,

    /** Normalized between plus/minus 1.0. */
    RTAUDIO_FLOAT64 = 0x20,
}

export type INodeRtAudioConfiguration = IAudioConfiguration & {
    chunkSize: number;
};

export interface NodeRtAudioOutputServiceConfig {
    audioType: AudioStreamType | string;
    configs: INodeRtAudioConfiguration[];
}

export class NodeRtAudioOutputService extends NodeAudioOutputService {
    private rtaudio;
    private stopTimeout: ReturnType<typeof setTimeout> | undefined;

    public constructor(
        config: NodeRtAudioOutputServiceConfig,
        events: ServiceEvents,
    ) {
        super(
            {
                ...config,
                audioType: stringToAudioStreamType(config.audioType),
            },
            events,
        );

        this.rtaudio = new RtAudio();
    }

    protected chunkSize(): number {
        const chunkSize = (this.channelConfig() as INodeRtAudioConfiguration)
            .chunkSize;
        assert(chunkSize !== undefined);
        return chunkSize;
    }

    protected rtAudioFormat(): RtAudioFormat {
        const numberOfBits = this.numberOfBits();
        switch (numberOfBits) {
            case 16:
                return RtAudioFormat.RTAUDIO_SINT16;
            default:
                throw new Error(`Unhandled number of bits: ${numberOfBits}`);
        }
    }

    protected override open(_data: ChannelOpenRequest): void {
        this.rtaudio.openStream(
            {
                nChannels: this.channelCount(),
            },
            null,
            this.rtAudioFormat() as number,
            this.sampleRate(),
            this.chunkSize(),
            this.constructor.name,
            null,
            null,
        );
    }

    protected override channelStart(_data: Start): void {
        if (this.stopTimeout !== undefined) {
            clearTimeout(this.stopTimeout);
        }

        this.rtaudio.start();
    }

    protected override channelStop(): void {
        if (this.stopTimeout !== undefined) {
            clearTimeout(this.stopTimeout);
        }

        this.stopTimeout = setTimeout(() => {
            this.rtaudio.stop();
        }, 1000);
    }

    public override stop(): void {
        super.stop();
        this.rtaudio.closeStream();
    }

    protected override handleData(
        buffer: Uint8Array,
        _timestamp?: bigint,
    ): void {
        const data = bufferWrapUint8Array(buffer);
        this.rtaudio.write(data);
    }
}
