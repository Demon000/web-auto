import { AudioOutputService, type ServiceEvents } from '@web-auto/android-auto';
import {
    AudioStreamType,
    ChannelOpenRequest,
    Setup,
    Start,
} from '@web-auto/android-auto-proto';
import type { IAudioConfiguration } from '@web-auto/android-auto-proto/interfaces.js';
import RtAudioPackage from 'audify';
import assert from 'node:assert';
import { bufferWrapUint8Array } from '@web-auto/android-auto';

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

    // eslint-disable-next-line @typescript-eslint/require-await
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

    // eslint-disable-next-line @typescript-eslint/require-await
    protected override async channelStart(_data: Start): Promise<void> {
        this.rtaudio.start();
    }

    protected async setup(_data: Setup): Promise<void> {
        // TODO
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected override async channelStop(): Promise<void> {
        this.rtaudio.stop();
    }

    public override stop(): void {
        super.stop();
        this.rtaudio.closeStream();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async handleData(
        buffer: Uint8Array,
        _timestamp?: bigint,
    ): Promise<void> {
        const data = bufferWrapUint8Array(buffer);
        this.rtaudio.write(data);
    }
}
