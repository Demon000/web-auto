import { ICryptor } from '../ssl/ICryptor';
import { ITransport } from '../transport/ITransport';
import { Message } from './Message';

export class MessageOutStream {
    private offset = 0;
    private remainingSize = 0;

    public constructor(
        private transport: ITransport,
        private cryptor: ICryptor,
    ) {}

    public async stream(message: Message): Promise<void> {}
}
