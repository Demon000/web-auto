import {
    ControlService,
    Cryptor,
    DeviceHandler,
    SensorService,
    Service,
    type AndroidAutoServerBuilder,
    type ControlServiceEvents,
    type DeviceHandlerEvents,
    type ServiceEvents,
} from '@web-auto/android-auto';
import {
    type AndroidAutoInputService,
    type AndroidAutoInputClient,
    AndroidAutoIpcNames,
    type AndroidAutoVideoService,
    type AndroidAutoVideoClient,
    type AndroidAutoMediaStatusService,
    type AndroidAutoMediaStatusClient,
} from '@web-auto/android-auto-ipc';
import { AudioStreamType } from '@web-auto/android-auto-proto';
import { NodeCryptor } from './crypto/NodeCryptor.js';
import { NodeAudioInputService } from './services/NodeAudioInputService.js';
import { NodeAudioOutputService } from './services/NodeAudioOutputService.js';
import { NodeClusterInputService } from './services/NodeClusterInputService.js';
import { NodeClusterVideoService } from './services/NodeClusterVideoService.js';
import { NodeAutoInputService } from './services/NodeInputService.js';
import { NodeMediaStatusService } from './services/NodeMediaStatusService.js';
import { NodeNavigationStatusService } from './services/NodeNavigationService.js';
import { NodeSensorsBuilder } from './services/NodeSensorBuilder.js';
import { NodeVideoService } from './services/NodeVideoService.js';
import { TcpDeviceHandler } from './transport/TcpDeviceHandler.js';
import { UsbDeviceHandler } from './transport/UsbDeviceHandler.js';
import { ElectronBluetoothDeviceHandler } from './transport/bluetooth/BluetoothDeviceHandler.js';
import type { NodeAndroidAutoServerConfig } from './config.js';
import type { IpcServiceRegistry } from '@web-auto/common-ipc/main.js';

export class NodeAndroidAutoServerBuilder implements AndroidAutoServerBuilder {
    public constructor(
        protected ipcRegistry: IpcServiceRegistry,
        protected config: NodeAndroidAutoServerConfig,
    ) {}

    public buildDeviceHandlers(events: DeviceHandlerEvents): DeviceHandler[] {
        const deviceHandlers: DeviceHandler[] = [
            new UsbDeviceHandler(this.config.usbDeviceHandlerConfig, events),
            new TcpDeviceHandler(this.config.tcpDeviceHandlerConfig, events),
        ];

        if (this.config.bluetoothDeviceHandlerConfig !== undefined) {
            deviceHandlers.push(
                new ElectronBluetoothDeviceHandler(
                    this.config.bluetoothDeviceHandlerConfig,
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
        return new NodeCryptor(
            this.config.cryptorConfig,
            certificateBuffer,
            privateKeyBuffer,
        );
    }
    public buildControlService(
        cryptor: Cryptor,
        events: ControlServiceEvents,
    ): ControlService {
        return new ControlService(cryptor, this.config.controlConfig, events);
    }

    public buildServices(events: ServiceEvents): Service[] {
        const inputIpcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoInputService,
            AndroidAutoInputClient
        >(AndroidAutoIpcNames.INPUT);

        const videoIpcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoVideoService,
            AndroidAutoVideoClient
        >(AndroidAutoIpcNames.VIDEO);

        const clusterVideoIpcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoVideoService,
            AndroidAutoVideoClient
        >(AndroidAutoIpcNames.CLUSTER_VIDEO);

        const mediaStatusIpcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoMediaStatusService,
            AndroidAutoMediaStatusClient
        >(AndroidAutoIpcNames.MEDIA_STATUS);

        const sensorsBuilder = new NodeSensorsBuilder(
            this.config.sensorConfigs,
        );

        const sensorService = new SensorService(sensorsBuilder, events);

        return [
            new NodeAudioInputService(events),
            new NodeAudioOutputService(
                AudioStreamType.AUDIO_STREAM_MEDIA,
                [
                    {
                        samplingRate: 48000,
                        numberOfChannels: 2,
                        numberOfBits: 16,
                    },
                ],
                events,
            ),
            new NodeAudioOutputService(
                AudioStreamType.AUDIO_STREAM_GUIDANCE,
                [
                    {
                        samplingRate: 48000,
                        numberOfChannels: 1,
                        numberOfBits: 16,
                    },
                ],
                events,
            ),
            new NodeAudioOutputService(
                AudioStreamType.AUDIO_STREAM_SYSTEM_AUDIO,
                [
                    {
                        samplingRate: 16000,
                        numberOfChannels: 1,
                        numberOfBits: 16,
                    },
                ],
                events,
            ),
            sensorService,
            new NodeNavigationStatusService(events),
            new NodeMediaStatusService(mediaStatusIpcHandler, events),
            new NodeAutoInputService(
                inputIpcHandler,
                this.config.touchScreenConfig,
                events,
            ),
            new NodeVideoService(
                videoIpcHandler,
                this.config.videoConfigs,
                events,
            ),
            new NodeClusterVideoService(
                clusterVideoIpcHandler,
                this.config.clusterVideoConfigs,
                events,
            ),
            new NodeClusterInputService(events),
        ];
    }
}
