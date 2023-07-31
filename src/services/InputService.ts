import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { InputChannel } from '../proto/types';
import { ChannelOpenRequest, ChannelDescriptor } from '../proto/types';
import { Service } from './Service';

export class InputService extends Service {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.INPUT, messageInStream, messageOutStream);
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
        channelDescriptor.inputChannel = InputChannel.create({
            supportedKeycodes: [],
            touchScreenConfig: {
                width: 1920,
                height: 1080,
            },
        });
    }
}
