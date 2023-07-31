import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { AVInputChannel, AVStreamType } from '../proto/types';
import { ChannelOpenRequest, ChannelDescriptor } from '../proto/types';
import { Service } from './Service';

export class AudioInputService extends Service {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.AV_INPUT, messageInStream, messageOutStream);
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
        channelDescriptor.avInputChannel = AVInputChannel.create({
            streamType: AVStreamType.Enum.AUDIO,
            audioConfig: {
                sampleRate: 16000,
                bitDepth: 16,
                channelCount: 1,
            },
        });
    }
}
