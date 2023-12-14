import {
    AudioOutputService,
    DataBuffer,
    type ServiceEvents,
} from '@web-auto/android-auto';
import {
    AudioStreamType,
    ChannelOpenRequest,
    Setup,
    Start,
} from '@web-auto/android-auto-proto';
import type { IAudioConfiguration } from '@web-auto/android-auto-proto/interfaces.js';
import RtAudioPackage from 'audify';
import assert from 'node:assert';

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

export class NodeAudioOutputService extends AudioOutputService {
    private rtaudio;

    public constructor(
        audioType: AudioStreamType,
        configs: IAudioConfiguration[],
        events: ServiceEvents,
    ) {
        super(audioType, configs, events);

        assert(configs.length === 1);
        this.configurationIndex = 0;

        this.rtaudio = new RtAudio();
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

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        this.rtaudio.openStream(
            {
                nChannels: this.channelCount(),
            },
            null,
            this.rtAudioFormat() as number,
            this.sampleRate(),
            2048,
            this.constructor.name,
            null,
            null,
        );
    }

    protected async channelStart(_data: Start): Promise<void> {
        this.rtaudio.start();
    }

    protected async setup(_data: Setup): Promise<void> {
        // TODO
    }

    protected async channelStop(): Promise<void> {
        this.rtaudio.stop();
    }

    public async stop(): Promise<void> {
        await super.stop();
        this.rtaudio.closeStream();
    }

    protected async handleData(
        buffer: DataBuffer,
        _timestamp?: bigint,
    ): Promise<void> {
        this.rtaudio.write(buffer.data);
    }
}
