import { ChannelId } from '@/messenger/ChannelId';
import { MessageInStream } from '@/messenger/MessageInStream';
import { MessageOutStream } from '@/messenger/MessageOutStream';
import {
    AVChannel,
    AVStreamType,
    AudioType,
} from '@web-auto/android-auto-proto';
import { ChannelDescriptor } from '@web-auto/android-auto-proto';
import { AVOutputService } from './AVOutputService';

export abstract class AudioOutputService extends AVOutputService {
    public constructor(
        channelId: ChannelId,
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(channelId, messageInStream, messageOutStream);
    }

    protected channelConfig(): [AudioType.Enum, number, number, number] {
        switch (this.channelId) {
            case ChannelId.MEDIA_AUDIO:
                return [AudioType.Enum.MEDIA, 2, 48000, 2048];
            case ChannelId.SYSTEM_AUDIO:
                return [AudioType.Enum.SYSTEM, 1, 16000, 1024];
            case ChannelId.SPEECH_AUDIO:
                return [AudioType.Enum.SPEECH, 1, 16000, 1024];
            default:
                throw new Error(
                    `Invalid channel id ${this.channelName} for audio service`,
                );
        }
    }

    protected audioType(): number {
        return this.channelConfig()[0];
    }

    protected channelCount(): number {
        return this.channelConfig()[1];
    }

    protected sampleRate(): number {
        return this.channelConfig()[2];
    }

    protected chunkSize(): number {
        return this.channelConfig()[3];
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.avChannel = AVChannel.create({
            streamType: AVStreamType.Enum.AUDIO,
            audioType: this.audioType(),
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
