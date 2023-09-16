import { ICryptor } from '@/ssl/ICryptor';

import { ControlService } from './ControlService';
import { Service } from './Service';

export abstract class ServiceFactory {
    public abstract buildControlService(cryptor: ICryptor): ControlService;
    public abstract buildServices(): Service[];
}
