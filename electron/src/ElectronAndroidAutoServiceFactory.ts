import {
    ControlService,
    DummyAudioInputService,
    DummyAudioOutputService,
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
    ElectronAndroidAutoVideoService,
    ElectronAndroidAutoVideoServiceEvent,
    ElectronAndroidAutoVideoServiceEvents,
} from './ElectronAndroidAutoVideoService';
import EventEmitter from 'eventemitter3';
import {
    ITouchConfig,
    ITouchEvent,
    IVideoConfig,
} from '@web-auto/android-auto-proto';
import {
    ElectronAndroidAutoInputService,
    ElectronAndroidAutoInputServiceEvent,
    ElectronAndroidAutoInputServiceEvents,
} from './ElectronAndroidAutoInputService';

export class ElectronAndroidAutoServiceFactory extends ServiceFactory {
    public emitter = new EventEmitter<
        | ElectronAndroidAutoVideoServiceEvents
        | ElectronAndroidAutoInputServiceEvents
    >();

    public constructor(
        private videoConfigs: IVideoConfig[],
        private touchSreenConfig: ITouchConfig,
    ) {
        super();
    }

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
        const videoService = new ElectronAndroidAutoVideoService(
            this.videoConfigs,
            messageInStream,
            messageOutStream,
        );
        const inputService = new ElectronAndroidAutoInputService(
            this.touchSreenConfig,
            messageInStream,
            messageOutStream,
        );

        videoService.emitter.on(
            ElectronAndroidAutoVideoServiceEvent.DATA,
            (buffer) => {
                this.emitter.emit(
                    ElectronAndroidAutoVideoServiceEvent.DATA,
                    buffer,
                );
            },
        );

        this.emitter.on(
            ElectronAndroidAutoInputServiceEvent.TOUCH,
            (data: ITouchEvent) => {
                inputService.sendTouchEvent(data);
            },
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
            new DummySensorService(messageInStream, messageOutStream),
            videoService,
            new DummyNavigationStatusService(messageInStream, messageOutStream),
            new DummyMediaStatusService(messageInStream, messageOutStream),
            inputService,
        ];

        return services;
    }
}
