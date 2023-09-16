import { ChannelId } from '@/messenger/ChannelId';
import { ControlService } from '@/services/ControlService';
import { Service } from '@/services/Service';
import { ServiceFactory } from '@/services/ServiceFactory';
import { Cryptor } from '@/crypto/Cryptor';
import { DummyAudioInputService } from './DummyAudioInputService';
import { DummyAudioOutputService } from './DummyAudioOutputService';
import { DummyInputService } from './DummyInputService';
import { DummyMediaStatusService } from './DummyMediaStatusService';
import { DummyNavigationStatusService } from './DummyNavigationService';
import { DummyVideoService } from './DummyVideoService';
import { DummySensorService } from '.';
import { DummyCryptor } from '../transport/DummyCryptor';

export class DummyServiceFactory extends ServiceFactory {
    public buildCryptor(
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ): Cryptor {
        return new DummyCryptor(certificateBuffer, privateKeyBuffer);
    }
    public buildControlService(cryptor: Cryptor): ControlService {
        return new ControlService(cryptor);
    }
    public buildServices(): Service[] {
        const videoService = new DummyVideoService();

        const services: Service[] = [
            new DummyAudioInputService(),
            new DummyAudioOutputService(ChannelId.MEDIA_AUDIO),
            new DummyAudioOutputService(ChannelId.SPEECH_AUDIO),
            new DummyAudioOutputService(ChannelId.SYSTEM_AUDIO),
            new DummySensorService(),
            videoService,
            new DummyNavigationStatusService(),
            new DummyMediaStatusService(),
            new DummyInputService(),
        ];

        return services;
    }
}
