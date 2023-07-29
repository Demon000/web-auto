import { channelIdString } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import {
    MessageInStream,
    MessageInStreamEvent,
} from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';

export type ServiceSendMessageOptions = Omit<MessageFrameOptions, 'channelId'>;

export abstract class Service {
    public constructor(
        protected channelId: number,
        protected messageInStream: MessageInStream,
        protected messageOutStream: MessageOutStream,
    ) {
        this.messageInStream
            .channelEmitter(this.channelId)
            .on(
                MessageInStreamEvent.MESSAGE_RECEIVED,
                this.onMessageInner.bind(this),
            );
    }

    private onMessageInner(
        message: Message,
        options?: MessageFrameOptions,
    ): void {
        const found = this.onMessage(message, options);
        if (found) {
            return;
        }

        console.log(
            `Unhandled message with id ${
                message.messageId
            } on channel ${channelIdString(this.channelId)}`,
            message.getPayload(),
            options,
        );
    }

    protected abstract onMessage(
        message: Message,
        options?: MessageFrameOptions,
    ): boolean;

    public async sendMessage(
        message: Message,
        options: ServiceSendMessageOptions,
    ): Promise<void> {
        return this.messageOutStream.send(message, {
            channelId: this.channelId,
            ...options,
        });
    }
}
