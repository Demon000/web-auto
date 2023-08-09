import { ChannelId } from '@/messenger/ChannelId';
import { MessageInStream } from '@/messenger/MessageInStream';
import { MessageOutStream } from '@/messenger/MessageOutStream';
import { ControlService } from '@/services/ControlService';
import { SensorService } from '@/services/SensorService';
import { Service } from '@/services/Service';
import { ServiceFactory } from '@/services/ServiceFactory';
import { ICryptor } from '@/ssl/ICryptor';
import { DummyAudioInputService } from './DummyAudioInputService';
import { DummyAudioOutputService } from './DummyAudioOutputService';
import { DummyInputService } from './DummyInputService';
import { DummyMediaStatusService } from './DummyMediaStatusService';
import { DummyNavigationStatusService } from './DummyNavigationService';
import { DummyVideoService } from './DummyVideoService';

export class DummyServiceFactory extends ServiceFactory {
    public buildControlService(
        cryptor: ICryptor,
        services: Service[],
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ): ControlService {
        return new ControlService(
            cryptor,
            services,
            messageInStream,
            messageOutStream,
        );
    }
    public buildServices(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ): Service[] {
        const videoService = new DummyVideoService(
            messageInStream,
            messageOutStream,
        );

        const services: Service[] = [
            new DummyAudioInputService(messageInStream, messageOutStream),
            new DummyAudioOutputService(
                ChannelId.MEDIA_AUDIO,
                messageInStream,
                messageOutStream,
            ),
            new DummyAudioOutputService(
                ChannelId.SPEECH_AUDIO,
                messageInStream,
                messageOutStream,
            ),
            new DummyAudioOutputService(
                ChannelId.SYSTEM_AUDIO,
                messageInStream,
                messageOutStream,
            ),
            new SensorService([], messageInStream, messageOutStream),
            videoService,
            new DummyNavigationStatusService(messageInStream, messageOutStream),
            new DummyMediaStatusService(messageInStream, messageOutStream),
            new DummyInputService(messageInStream, messageOutStream),
        ];

        return services;
    }
}
