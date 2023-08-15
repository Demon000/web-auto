import {
    ControlService,
    DummyAudioInputService,
    DummyAudioOutputService,
    DummyInputService,
    DummyMediaStatusService,
    DummyNavigationStatusService,
    DummySensorService,
    ServiceFactory,
} from '@web-auto/android-auto';
import { MessageInStream } from '@web-auto/android-auto';
import { MessageOutStream } from '@web-auto/android-auto';
import { Service } from '@web-auto/android-auto';
import { ICryptor } from '@web-auto/android-auto';
import { ChannelId } from '@web-auto/android-auto';
import {
    ElectronVideoService,
    ElectronVideoServiceEvent,
    ElectronVideoServiceEvents,
} from './ElectronVideoService';
import EventEmitter from 'eventemitter3';

export class ElectronServiceFactory extends ServiceFactory {
    public emitter = new EventEmitter<ElectronVideoServiceEvents>();

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
        const videoService = new ElectronVideoService(
            messageInStream,
            messageOutStream,
        );

        videoService.emitter.on(ElectronVideoServiceEvent.DATA, (buffer) => {
            this.emitter.emit(ElectronVideoServiceEvent.DATA, buffer);
        });

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
            new DummySensorService(messageInStream, messageOutStream),
            videoService,
            new DummyNavigationStatusService(messageInStream, messageOutStream),
            new DummyMediaStatusService(messageInStream, messageOutStream),
            new DummyInputService(messageInStream, messageOutStream),
        ];

        return services;
    }
}