import { ChannelId, channelIdString } from '../messenger/ChannelId';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import {
    AVChannelSetupRequest,
    AVChannelStartIndication,
    AVChannelStopIndication,
} from '../proto/types';
import { AVChannel, AVStreamType, AudioType } from '../proto/types';
import { ChannelOpenRequest, ChannelDescriptor } from '../proto/types';
import { DataBuffer } from '../utils/DataBuffer';
import { AVOutputService } from './AVOutputService';

export class AudioService extends AVOutputService {
    public constructor(
        channelId: ChannelId,
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(channelId, messageInStream, messageOutStream);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TOOD
    }

    protected async channelStart(
        _data: AVChannelStartIndication,
    ): Promise<void> {
        // TOOD
    }

    protected async setup(_data: AVChannelSetupRequest): Promise<void> {
        // TOOD
    }

    protected async channelStop(_data: AVChannelStopIndication): Promise<void> {
        // TOOD
    }

    protected async handleData(
        _buffer: DataBuffer,
        _timestamp?: bigint | undefined,
    ): Promise<void> {
        // TODO
    }

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
