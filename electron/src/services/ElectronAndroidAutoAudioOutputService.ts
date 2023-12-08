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
import RtAudioPackage from 'audify';

const RTAUDIO_SINT16 = 2;
const { RtAudio } = RtAudioPackage;

export class ElectronAndroidAutoAudioOutputService extends AudioOutputService {
    private rtaudio;

    public constructor(audioType: AudioStreamType, events: ServiceEvents) {
        super(audioType, events);

        this.rtaudio = new RtAudio();
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        this.rtaudio.openStream(
            {
                nChannels: this.channelCount(),
            },
            null,
            RTAUDIO_SINT16,
            this.sampleRate(),
            this.chunkSize(),
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
