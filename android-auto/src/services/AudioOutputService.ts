import { ChannelId, channelIdString } from '@/messenger/ChannelId';
import { MessageInStream } from '@/messenger/MessageInStream';
import { MessageOutStream } from '@/messenger/MessageOutStream';
import {
    AVChannelSetupRequest,
    AVChannelStartIndication,
    AVChannelStopIndication,
} from '@web-auto/android-auto-proto';
import {
    AVChannel,
    AVStreamType,
    AudioType,
} from '@web-auto/android-auto-proto';
import {
    ChannelDescriptor,
    ChannelOpenRequest,
} from '@web-auto/android-auto-proto';
import { DataBuffer } from '@/utils/DataBuffer';
import { AVOutputService } from './AVOutputService';

export abstract class AudioOutputService extends AVOutputService {
    public constructor(
        channelId: ChannelId,
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(channelId, messageInStream, messageOutStream);
    }

    protected abstract open(data: ChannelOpenRequest): Promise<void>;

    protected abstract channelStart(
        data: AVChannelStartIndication,
    ): Promise<void>;

    protected abstract setup(data: AVChannelSetupRequest): Promise<void>;

    protected abstract channelStop(
        data: AVChannelStopIndication,
    ): Promise<void>;

    protected abstract handleData(
        _buffer: DataBuffer,
        _timestamp?: bigint | undefined,
    ): Promise<void>;

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        let audioType;

        switch (this.channelId) {
            case ChannelId.MEDIA_AUDIO:
                audioType = AudioType.Enum.MEDIA;
                break;
            case ChannelId.SYSTEM_AUDIO:
                audioType = AudioType.Enum.SYSTEM;
                break;
            case ChannelId.SPEECH_AUDIO:
                audioType = AudioType.Enum.SPEECH;
                break;
            default:
                throw new Error(
                    `Invalid channel id ${channelIdString(
                        this.channelId,
                    )} for audio service`,
                );
        }

        channelDescriptor.avChannel = AVChannel.create({
            streamType: AVStreamType.Enum.AUDIO,
            audioType,
            availableWhileInCall: true,
            audioConfigs: [
                {
                    bitDepth: 16,
                    channelCount: audioType === AudioType.Enum.MEDIA ? 2 : 1,
                    sampleRate:
                        audioType === AudioType.Enum.MEDIA ? 48000 : 16000,
                },
            ],
        });
    }
}
