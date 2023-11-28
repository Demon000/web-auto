import { Cryptor } from '@/crypto/Cryptor';

import { ControlService, ControlServiceEvents } from './ControlService';
import { Service, ServiceEvents } from './Service';

export abstract class ServiceFactory {
    public abstract buildCryptor(
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ): Cryptor;
    public abstract buildControlService(
        events: ControlServiceEvents,
    ): ControlService;
    public abstract buildServices(events: ServiceEvents): Service[];
}
