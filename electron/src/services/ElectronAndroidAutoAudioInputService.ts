import {
    AudioInputService,
    DataBuffer,
    ServiceEvents,
} from '@web-auto/android-auto';
import {
    AVChannelSetupRequest,
    AVInputOpenRequest,
    ChannelOpenRequest,
} from '@web-auto/android-auto-proto';
import { RtAudio, RtAudioFormat } from 'audify';

export class ElectronAndroidAutoAudioInputService extends AudioInputService {
    private rtaudio: RtAudio;

    public constructor(events: ServiceEvents) {
        super(events);

        this.rtaudio = new RtAudio();
        this.session = 0;
    }

    protected async setup(_data: AVChannelSetupRequest): Promise<void> {
        // TODO
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        this.rtaudio.openStream(
            null,
            {
                nChannels: this.channelCount(),
            },
            RtAudioFormat.RTAUDIO_SINT16,
            this.sampleRate(),
            this.chunkSize(),
            this.constructor.name,
            async (data) => {
                void this.sendAvMediaWithTimestampIndication(
                    DataBuffer.fromBuffer(data),
                );
            },
            null,
        );
    }

    public stop(): void {
        this.rtaudio.closeStream();
        super.stop();
    }

    protected async inputOpen(data: AVInputOpenRequest): Promise<void> {
        if (data.open) {
            this.rtaudio.start();
        } else {
            this.rtaudio.stop();
        }
    }
}
