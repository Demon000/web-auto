import { MessageInStream } from '@/messenger/MessageInStream';
import { MessageOutStream } from '@/messenger/MessageOutStream';
import { ICryptor } from '@/ssl/ICryptor';

import { ControlService } from './ControlService';
import { Service } from './Service';

export abstract class ServiceFactory {
    public abstract buildControlService(
        cryptor: ICryptor,
        services: Service[],
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ): ControlService;
    public abstract buildServices(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ): Service[];
}
