import { ChannelId, channelIdString } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { AVChannel, AVStreamType, AudioType } from '../proto/types';
import { ChannelOpenRequest, ChannelDescriptor } from '../proto/types';
import { Service } from './Service';

export class AudioService extends Service {
    public constructor(
        channelId: ChannelId,
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(channelId, messageInStream, messageOutStream);
    }

    protected async openChannel(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected onMessage(
        _message: Message,
        _options?: MessageFrameOptions | undefined,
    ): boolean {
        return false;
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
                    channelCount: 2,
                    sampleRate: 16000,
                },
            ],
        });
    }
}
