import {
    ControlService,
    DataBuffer,
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
import { ElectronAndroidAutoAudioOutputService } from './ElectronAndroidAutoAudioOutputService';
import { ElectronAndroidAutoAudioInputService } from './ElectronAndroidAutoAudioInputService';

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
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ): ControlService {
        return new ControlService(cryptor, messageInStream, messageOutStream);
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

        const onVideoData = (buffer: DataBuffer) => {
            this.emitter.emit(
                ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA,
                buffer,
            );
        };

        videoService.emitter.on(
            ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA,
            onVideoData,
        );

        videoService.emitter.once(
            ElectronAndroidAutoVideoServiceEvent.STOP,
            () => {
                videoService.emitter.off(
                    ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA,
                    onVideoData,
                );
            },
        );

        const inputService = new ElectronAndroidAutoInputService(
            this.touchSreenConfig,
            messageInStream,
            messageOutStream,
        );

        const onTouchEvent = (data: ITouchEvent) => {
            inputService.sendTouchEvent(data);
        };

        this.emitter.on(
            ElectronAndroidAutoInputServiceEvent.TOUCH,
            onTouchEvent,
        );

        inputService.emitter.once(
            ElectronAndroidAutoInputServiceEvent.STOP,
            () => {
                this.emitter.off(
                    ElectronAndroidAutoInputServiceEvent.TOUCH,
                    onTouchEvent,
                );
            },
        );

        const services: Service[] = [
            new ElectronAndroidAutoAudioInputService(
                messageInStream,
                messageOutStream,
            ),
            new ElectronAndroidAutoAudioOutputService(
                ChannelId.MEDIA_AUDIO,
                messageInStream,
                messageOutStream,
            ),
            new ElectronAndroidAutoAudioOutputService(
                ChannelId.SPEECH_AUDIO,
                messageInStream,
                messageOutStream,
            ),
            new ElectronAndroidAutoAudioOutputService(
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
