import {
    AudioInputService,
    DataBuffer,
    type ServiceEvents,
} from '@web-auto/android-auto';
import {
    ChannelOpenRequest,
    MicrophoneRequest,
    Setup,
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

    protected async setup(_data: Setup): Promise<void> {
        // TODO
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async open(_data: ChannelOpenRequest): Promise<void> {
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
                this.sendAvMediaWithTimestampIndication(
                    DataBuffer.fromBuffer(data),
                )
                    .then(() => {})
                    .catch((err) => {
                        this.logger.error('Failed to send data', err);
                    });
            },
            null,
        );
    }

    public stop(): void {
        super.stop();
        this.rtaudio.closeStream();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async inputOpen(data: MicrophoneRequest): Promise<void> {
        if (data.open) {
            this.rtaudio.start();
        } else {
            this.rtaudio.stop();
        }
    }
}
