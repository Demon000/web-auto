import {
    AVChannel,
    AVStreamType,
    AudioType,
} from '@web-auto/android-auto-proto';
import { ChannelDescriptor } from '@web-auto/android-auto-proto';
import { AVOutputService } from './AVOutputService.js';
import { type ServiceEvents } from './Service.js';

export abstract class AudioOutputService extends AVOutputService {
    public constructor(
        private audioType: AudioType.Enum,
        protected events: ServiceEvents,
    ) {
        super(events);
    }

    protected channelConfig(): [number, number, number] {
        switch (this.audioType) {
            case AudioType.Enum.MEDIA:
                return [2, 48000, 2048];
            case AudioType.Enum.SYSTEM:
                return [1, 16000, 1024];
            case AudioType.Enum.SPEECH:
                return [1, 16000, 1024];
            default:
                throw new Error(`Unhandled audio type ${this.audioType}`);
        }
    }

    protected channelCount(): number {
        return this.channelConfig()[0];
    }

    protected sampleRate(): number {
        return this.channelConfig()[1];
    }

    protected chunkSize(): number {
        return this.channelConfig()[2];
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.avChannel = AVChannel.create({
            streamType: AVStreamType.Enum.AUDIO,
            audioType: this.audioType,
            availableWhileInCall: true,
            audioConfigs: [
                {
                    bitDepth: 16,
                    channelCount: this.channelCount(),
                    sampleRate: this.sampleRate(),
                },
            ],
        });
    }
}
