import { Cryptor } from '@/crypto/Cryptor';

import { ControlService, ControlServiceEvents } from './ControlService';
import { Service, ServiceEvents } from './Service';
import { DeviceHandler, DeviceHandlerEvents } from '..';

export abstract class ServiceFactory {
    public abstract buildDeviceHandlers(
        events: DeviceHandlerEvents,
    ): DeviceHandler[];
    public abstract buildCryptor(
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ): Cryptor;
    public abstract buildControlService(
        events: ControlServiceEvents,
    ): ControlService;
    public abstract buildServices(events: ServiceEvents): Service[];
}
