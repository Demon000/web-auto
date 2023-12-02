import { Cryptor } from '../crypto/Cryptor.js';

import { ControlService, type ControlServiceEvents } from './ControlService.js';
import { Service, type ServiceEvents } from './Service.js';
import { DeviceHandler, type DeviceHandlerEvents } from '../index.js';

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
