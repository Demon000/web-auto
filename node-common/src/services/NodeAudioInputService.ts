import { AudioInputService, type ServiceEvents } from '@web-auto/android-auto';
import {
    ChannelOpenRequest,
    MicrophoneRequest,
} from '@web-auto/android-auto-proto';
import RtAudioPackage from 'audify';

const RTAUDIO_SINT16 = 2;
const { RtAudio } = RtAudioPackage;

export class NodeAudioInputService extends AudioInputService {
    private rtaudio;

    public constructor(events: ServiceEvents) {
        super(events);

        this.rtaudio = new RtAudio();
        this.session = 0;
    }

    protected override open(_data: ChannelOpenRequest): void {
        this.rtaudio.openStream(
            null,
            {
                nChannels: this.channelCount(),
            },
            RTAUDIO_SINT16,
            this.sampleRate(),
            this.chunkSize(),
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

    protected inputOpen(data: MicrophoneRequest): void {
        if (data.open) {
            this.rtaudio.start();
        } else {
            this.rtaudio.stop();
        }
    }
}
