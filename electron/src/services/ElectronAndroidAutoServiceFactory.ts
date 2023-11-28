import {
    ControlService,
    ControlServiceConfig,
    ControlServiceEvents,
    DataBuffer,
    InputService,
    ServiceEvents,
    ServiceFactory,
    VideoService,
} from '@web-auto/android-auto';
import { Service } from '@web-auto/android-auto';
import { Cryptor } from '@web-auto/android-auto';
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
import { NodeCryptor } from '@/crypto/NodeCryptor';
import { DummySensorService } from './DummySensorService';
import { DummyNavigationStatusService } from './DummyNavigationService';
import { DummyMediaStatusService } from './DummyMediaStatusService';

export class ElectronAndroidAutoServiceFactory extends ServiceFactory {
    public emitter = new EventEmitter<
        | ElectronAndroidAutoVideoServiceEvents
        | ElectronAndroidAutoInputServiceEvents
    >();

    public constructor(
        private controlConfig: ControlServiceConfig,
        private videoConfigs: IVideoConfig[],
        private touchSreenConfig: ITouchConfig,
    ) {
        super();
    }

    public buildCryptor(
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ): Cryptor {
        return new NodeCryptor(certificateBuffer, privateKeyBuffer);
    }

    public buildControlService(events: ControlServiceEvents): ControlService {
        return new ControlService(this.controlConfig, events);
    }

    private buildVideoService(events: ServiceEvents): VideoService {
        const videoService = new ElectronAndroidAutoVideoService(
            this.videoConfigs,
            events,
        );

        const onVideoStart = () => {
            this.emitter.emit(ElectronAndroidAutoVideoServiceEvent.VIDEO_START);
        };

        const onVideoStop = () => {
            this.emitter.emit(ElectronAndroidAutoVideoServiceEvent.VIDEO_STOP);
        };

        videoService.extraEmitter.on(
            ElectronAndroidAutoVideoServiceEvent.VIDEO_START,
            onVideoStart,
        );

        videoService.extraEmitter.on(
            ElectronAndroidAutoVideoServiceEvent.VIDEO_STOP,
            onVideoStop,
        );

        const onVideoData = (buffer: DataBuffer) => {
            this.emitter.emit(
                ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA,
                buffer,
            );
        };

        videoService.extraEmitter.on(
            ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA,
            onVideoData,
        );

        videoService.extraEmitter.once(
            ElectronAndroidAutoVideoServiceEvent.STOP,
            () => {
                videoService.extraEmitter.off(
                    ElectronAndroidAutoVideoServiceEvent.VIDEO_START,
                    onVideoStart,
                );
                videoService.extraEmitter.off(
                    ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA,
                    onVideoData,
                );
                videoService.extraEmitter.off(
                    ElectronAndroidAutoVideoServiceEvent.VIDEO_STOP,
                    onVideoStop,
                );
            },
        );

        return videoService;
    }
    private buildInputService(events: ServiceEvents): InputService {
        const inputService = new ElectronAndroidAutoInputService(
            this.touchSreenConfig,
            events,
        );

        const onTouchEvent = (data: ITouchEvent) => {
            void inputService.sendTouchEvent(data);
        };

        this.emitter.on(
            ElectronAndroidAutoInputServiceEvent.TOUCH,
            onTouchEvent,
        );

        inputService.extraEmitter.once(
            ElectronAndroidAutoInputServiceEvent.STOP,
            () => {
                this.emitter.off(
                    ElectronAndroidAutoInputServiceEvent.TOUCH,
                    onTouchEvent,
                );
            },
        );

        return inputService;
    }
    public buildServices(events: ServiceEvents): Service[] {
        const videoService = this.buildVideoService(events);
        const inputService = this.buildInputService(events);

        const services: Service[] = [
            new ElectronAndroidAutoAudioInputService(events),
            new ElectronAndroidAutoAudioOutputService(
                ChannelId.MEDIA_AUDIO,
                events,
            ),
            new ElectronAndroidAutoAudioOutputService(
                ChannelId.SPEECH_AUDIO,
                events,
            ),
            new ElectronAndroidAutoAudioOutputService(
                ChannelId.SYSTEM_AUDIO,
                events,
            ),
            new DummySensorService(events),
            videoService,
            new DummyNavigationStatusService(events),
            new DummyMediaStatusService(events),
            inputService,
        ];

        return services;
    }
}
