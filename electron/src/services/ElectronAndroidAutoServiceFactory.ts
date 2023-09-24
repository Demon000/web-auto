import {
    ControlService,
    DataBuffer,
    DummyMediaStatusService,
    DummyNavigationStatusService,
    DummySensorService,
    InputService,
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

    public buildCryptor(
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ): Cryptor {
        return new NodeCryptor(certificateBuffer, privateKeyBuffer);
    }

    public buildControlService(): ControlService {
        return new ControlService();
    }

    private buildVideoService(): VideoService {
        const videoService = new ElectronAndroidAutoVideoService(
            this.videoConfigs,
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
            onVideoStart,
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
    private buildInputService(): InputService {
        const inputService = new ElectronAndroidAutoInputService(
            this.touchSreenConfig,
        );

        const onTouchEvent = (data: ITouchEvent) => {
            inputService.sendTouchEvent(data);
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
    public buildServices(): Service[] {
        const videoService = this.buildVideoService();
        const inputService = this.buildInputService();

        const services: Service[] = [
            new ElectronAndroidAutoAudioInputService(),
            new ElectronAndroidAutoAudioOutputService(ChannelId.MEDIA_AUDIO),
            new ElectronAndroidAutoAudioOutputService(ChannelId.SPEECH_AUDIO),
            new ElectronAndroidAutoAudioOutputService(ChannelId.SYSTEM_AUDIO),
            new DummySensorService(),
            videoService,
            new DummyNavigationStatusService(),
            new DummyMediaStatusService(),
            inputService,
        ];

        return services;
    }
}
