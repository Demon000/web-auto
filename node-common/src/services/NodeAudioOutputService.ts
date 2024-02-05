import { AudioOutputService, type ServiceEvents } from '@web-auto/android-auto';
import { AudioStreamType } from '@web-auto/android-auto-proto';
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
        super(audioType, configs, [0], events);

        assert(configs.length === 1);
        this.configurationIndex = 0;

        this.rtaudio = new RtAudio();

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

        this.rtaudio.start();
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

    public override destroy(): void {
        this.rtaudio.stop();
        this.rtaudio.closeStream();
    }

    protected handleData(buffer: Uint8Array, _timestamp?: bigint): void {
        const data = bufferWrapUint8Array(buffer);
        this.rtaudio.write(data);
    }
}
