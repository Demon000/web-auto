import {
    ControlService,
    type ControlServiceEvents,
    DeviceHandler,
    type DeviceHandlerEvents,
    InputService,
    type ServiceEvents,
    ServiceFactory,
    VideoService,
} from '@web-auto/android-auto';
import { Service } from '@web-auto/android-auto';
import { Cryptor } from '@web-auto/android-auto';
import {
    ElectronAndroidAutoVideoService,
    ElectronAndroidAutoVideoServiceEvent,
    type ElectronAndroidAutoVideoServiceEvents,
} from './ElectronAndroidAutoVideoService.js';
import EventEmitter from 'eventemitter3';
import { AudioType, type ITouchEvent } from '@web-auto/android-auto-proto';
import {
    ElectronAndroidAutoInputService,
    ElectronAndroidAutoInputServiceEvent,
    type ElectronAndroidAutoInputServiceEvents,
} from './ElectronAndroidAutoInputService.js';
import { ElectronAndroidAutoAudioOutputService } from './ElectronAndroidAutoAudioOutputService.js';
import { ElectronAndroidAutoAudioInputService } from './ElectronAndroidAutoAudioInputService.js';
import { NodeCryptor } from '../crypto/NodeCryptor.js';
import { DummySensorService } from './DummySensorService.js';
import { DummyNavigationStatusService } from './DummyNavigationService.js';
import { DummyMediaStatusService } from './DummyMediaStatusService.js';
import { type AndroidAutoConfig } from '../config.js';
import { ElectronUsbDeviceHandler } from '../transport/ElectronUsbDeviceHandler.js';
import { ElectronTcpDeviceHandler } from '../transport/ElectronTcpDeviceHandler.js';
import { ElectronBluetoothDeviceHandler } from '../transport/bluetooth/ElectronBluetoothDeviceHandler.js';

export class ElectronAndroidAutoServiceFactory extends ServiceFactory {
    public emitter = new EventEmitter<
        | ElectronAndroidAutoVideoServiceEvents
        | ElectronAndroidAutoInputServiceEvents
    >();

    public constructor(private androidAutoConfig: AndroidAutoConfig) {
        super();
    }

    public buildDeviceHandlers(events: DeviceHandlerEvents): DeviceHandler[] {
        const deviceHandlers: DeviceHandler[] = [
            new ElectronUsbDeviceHandler(
                this.androidAutoConfig.usbDeviceHandlerConfig,
                events,
            ),
            new ElectronTcpDeviceHandler(
                this.androidAutoConfig.tcpDeviceHandlerConfig,
                events,
            ),
        ];

        if (this.androidAutoConfig.bluetoothDeviceHandlerConfig !== undefined) {
            deviceHandlers.push(
                new ElectronBluetoothDeviceHandler(
                    this.androidAutoConfig.bluetoothDeviceHandlerConfig,
                    events,
                ),
            );
        }

        return deviceHandlers;
    }

    public buildCryptor(
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ): Cryptor {
        return new NodeCryptor(certificateBuffer, privateKeyBuffer);
    }

    public buildControlService(events: ControlServiceEvents): ControlService {
        return new ControlService(this.androidAutoConfig.controlConfig, events);
    }

    private buildVideoService(events: ServiceEvents): VideoService {
        const videoService = new ElectronAndroidAutoVideoService(
            this.androidAutoConfig.videoConfigs,
            events,
        );

        videoService.extraEmitter.on(
            ElectronAndroidAutoVideoServiceEvent.VIDEO_START,
            () => {
                this.emitter.emit(
                    ElectronAndroidAutoVideoServiceEvent.VIDEO_START,
                );
            },
        );

        videoService.extraEmitter.on(
            ElectronAndroidAutoVideoServiceEvent.VIDEO_STOP,
            () => {
                this.emitter.emit(
                    ElectronAndroidAutoVideoServiceEvent.VIDEO_STOP,
                );
            },
        );

        videoService.extraEmitter.on(
            ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA,
            (buffer) => {
                this.emitter.emit(
                    ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA,
                    buffer,
                );
            },
        );

        return videoService;
    }
    private buildInputService(events: ServiceEvents): InputService {
        const inputService = new ElectronAndroidAutoInputService(
            this.androidAutoConfig.touchScreenConfig,
            events,
        );

        this.emitter.on(
            ElectronAndroidAutoInputServiceEvent.TOUCH,
            (data: ITouchEvent) => {
                void inputService.sendTouchEvent(data);
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
                AudioType.Enum.MEDIA,
                events,
            ),
            new ElectronAndroidAutoAudioOutputService(
                AudioType.Enum.SPEECH,
                events,
            ),
            new ElectronAndroidAutoAudioOutputService(
                AudioType.Enum.SYSTEM,
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
