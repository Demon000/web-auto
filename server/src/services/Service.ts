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
                this.onMessage.bind(this),
            );
    }

    protected abstract onMessage(message: Message): void;

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
