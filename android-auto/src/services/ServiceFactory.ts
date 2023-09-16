import { Cryptor } from '@/crypto/Cryptor';

import { ControlService } from './ControlService';
import { Service } from './Service';

export abstract class ServiceFactory {
    public abstract buildCryptor(
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ): Cryptor;
    public abstract buildControlService(cryptor: Cryptor): ControlService;
    public abstract buildServices(): Service[];
}
