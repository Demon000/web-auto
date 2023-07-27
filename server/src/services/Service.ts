import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';

export class Service {
    public constructor(
        protected channelId: number,
        protected messageInStream: MessageInStream,
        protected messageOutStream: MessageOutStream,
    ) {}
}
