import {
    AudioOutputService,
    ChannelId,
    DataBuffer,
} from '@web-auto/android-auto';
import {
    AVChannelSetupRequest,
    AVChannelStartIndication,
    AVChannelStopIndication,
    ChannelOpenRequest,
} from '@web-auto/android-auto-proto';
import { RtAudio, RtAudioFormat } from 'audify';
import Long from 'long';

export class ElectronAndroidAutoAudioOutputService extends AudioOutputService {
    private rtaudio: RtAudio;

    public constructor(channelId: ChannelId) {
        super(channelId);

        this.rtaudio = new RtAudio();
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        this.rtaudio.openStream(
            {
                nChannels: this.channelCount(),
            },
            null,
            RtAudioFormat.RTAUDIO_SINT16,
            this.sampleRate(),
            this.chunkSize(),
            this.constructor.name,
            null,
            null,
        );
    }

    protected async channelStart(
        _data: AVChannelStartIndication,
    ): Promise<void> {
        this.rtaudio.start();
    }

    protected async setup(_data: AVChannelSetupRequest): Promise<void> {
        // TODO
    }

    protected async channelStop(_data: AVChannelStopIndication): Promise<void> {
        this.rtaudio.stop();
    }

    protected async handleData(
        buffer: DataBuffer,
        _timestamp?: Long,
    ): Promise<void> {
        this.rtaudio.write(buffer.data);
    }
}
