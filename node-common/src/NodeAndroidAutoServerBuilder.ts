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
import {
    AudioStreamType,
    DisplayType,
    ServiceDiscoveryResponse,
    TouchScreenType,
    VideoCodecResolutionType,
} from '@web-auto/android-auto-proto';
import { NodeCryptor } from './crypto/NodeCryptor.js';
import { NodeAudioInputService } from './services/NodeAudioInputService.js';
import { NodeAudioOutputService } from './services/NodeAudioOutputService.js';
import { NodeAutoInputService } from './services/NodeInputService.js';
import { NodeMediaStatusService } from './services/NodeMediaStatusService.js';
import { NodeNavigationStatusService } from './services/NodeNavigationService.js';
import { NodeSensorsBuilder } from './services/NodeSensorBuilder.js';
import { NodeVideoService } from './services/NodeVideoService.js';
import { TcpDeviceHandler } from './transport/TcpDeviceHandler.js';
import { UsbDeviceHandler } from './transport/UsbDeviceHandler.js';
import { ElectronBluetoothDeviceHandler } from './transport/bluetooth/BluetoothDeviceHandler.js';
import type {
    NodeAndroidAutoDisplayConfig,
    NodeAndroidAutoServerConfig,
    NodeAndroidAutoResolutionConfig,
} from './config.js';
import type { IpcServiceRegistry } from '@web-auto/common-ipc/main.js';
import type {
    IInsets,
    IVideoConfiguration,
} from '@web-auto/android-auto-proto/interfaces.js';

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
        serviceDiscoveryResponse: ServiceDiscoveryResponse,
        events: ControlServiceEvents,
    ): ControlService {
        return new ControlService(
            cryptor,
            this.config.controlConfig,
            serviceDiscoveryResponse,
            events,
        );
    }

    private getSupportedResolutions(
        resolutionConfigs: NodeAndroidAutoResolutionConfig[],
    ): VideoCodecResolutionType[] {
        const resolutions = new Set<VideoCodecResolutionType>();

        for (const resolutionConfig of resolutionConfigs) {
            resolutions.add(resolutionConfig.resolution);
        }

        return Array.from(resolutions);
    }

    private resolutionToSize(
        resolution: VideoCodecResolutionType,
    ): [number, number] {
        switch (resolution) {
            case VideoCodecResolutionType.VIDEO_800x480:
                return [800, 480];
            case VideoCodecResolutionType.VIDEO_1280x720:
                return [1280, 720];
            case VideoCodecResolutionType.VIDEO_1920x1080:
                return [1920, 1080];
            case VideoCodecResolutionType.VIDEO_2560x1440:
                return [2560, 1440];
            case VideoCodecResolutionType.VIDEO_3840x2160:
                return [3840, 2160];
            case VideoCodecResolutionType.VIDEO_720x1280:
                return [720, 1280];
            case VideoCodecResolutionType.VIDEO_1080x1920:
                return [1080, 1920];
            case VideoCodecResolutionType.VIDEO_1440x2560:
                return [1440, 2560];
            case VideoCodecResolutionType.VIDEO_2160x3840:
                return [2160, 3840];
            default:
                throw new Error(
                    `Invalid resolution: ${VideoCodecResolutionType[resolution]}`,
                );
        }
    }

    private getResolutionMargins(
        resolution: VideoCodecResolutionType,
        displayConfig: NodeAndroidAutoDisplayConfig,
        scale: number,
    ): IInsets {
        const [width, height] = this.resolutionToSize(resolution);
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        const remainingWidth = scaledWidth - displayConfig.width;
        const remainingHeight = scaledHeight - displayConfig.height;
        const remainingUnscaledWidth = Math.round(remainingWidth / scale);
        const remainingUnscaledHeight = Math.round(remainingHeight / scale);

        return {
            left: 0,
            right: remainingUnscaledWidth,
            top: 0,
            bottom: remainingUnscaledHeight,
        };
    }

    private getResolutionRatio(
        resolution: VideoCodecResolutionType,
        displayConfig: NodeAndroidAutoDisplayConfig,
        cover: boolean,
    ): number {
        const [width, height] = this.resolutionToSize(resolution);

        const widthRatio = displayConfig.width / width;
        const heightRatio = displayConfig.height / height;

        return cover ? 1 : Math.max(widthRatio, heightRatio);
    }

    private canSizeFitResolution(
        width: number,
        height: number,
        resolution: VideoCodecResolutionType,
    ): boolean {
        const [resolutionWidth, resolutionHeight] =
            this.resolutionToSize(resolution);

        return resolutionWidth >= width && resolutionHeight >= height;
    }

    private isResolutionSmaller(
        resolution: VideoCodecResolutionType,
        thanResolution: VideoCodecResolutionType,
    ): boolean {
        const [thanWidth, thanHeight] = this.resolutionToSize(thanResolution);
        const [width, height] = this.resolutionToSize(resolution);

        return (
            (width < thanWidth && height < thanHeight) ||
            (width === thanWidth && height < thanHeight) ||
            (width < thanWidth && height === thanHeight)
        );
    }

    private findBestResolution(
        displayConfig: NodeAndroidAutoDisplayConfig,
        supportedResolutions: VideoCodecResolutionType[],
    ): VideoCodecResolutionType | undefined {
        let bestResolution;

        for (const resolution of supportedResolutions) {
            if (
                !this.canSizeFitResolution(
                    displayConfig.width,
                    displayConfig.height,
                    resolution,
                )
            ) {
                continue;
            }

            if (
                bestResolution !== undefined &&
                !this.isResolutionSmaller(resolution, bestResolution)
            ) {
                continue;
            }

            bestResolution = resolution;
        }

        return bestResolution;
    }

    private findSmallerResolutions(
        bigResolution: VideoCodecResolutionType | undefined,
        supportedResolutions: VideoCodecResolutionType[],
    ): VideoCodecResolutionType[] {
        const foundResolutions = [];

        for (const resolution of supportedResolutions) {
            if (
                bigResolution !== undefined &&
                !this.isResolutionSmaller(resolution, bigResolution)
            ) {
                continue;
            }

            foundResolutions.push(resolution);
        }

        return foundResolutions;
    }

    private getVideoResolutionConfigs(
        resolution: VideoCodecResolutionType,
        displayConfig: NodeAndroidAutoDisplayConfig,
        cover: boolean,
    ): IVideoConfiguration[] {
        const configs: IVideoConfiguration[] = [];

        const ratio = this.getResolutionRatio(resolution, displayConfig, cover);

        const dpi = Math.round(displayConfig.density / ratio);

        const margins = this.getResolutionMargins(
            resolution,
            displayConfig,
            ratio,
        );

        for (const resolutionConfig of displayConfig.resolutionConfigs) {
            if (resolution !== resolutionConfig.resolution) {
                continue;
            }

            configs.push({
                codecResolution: resolution,
                density: dpi,
                frameRate: resolutionConfig.framerate,
                videoCodecType: resolutionConfig.codec,
                uiConfig: {
                    margins,
                },
            });
        }

        return configs;
    }

    private getVideoConfigs(
        displayConfig: NodeAndroidAutoDisplayConfig,
    ): IVideoConfiguration[] {
        const supportedResolutions = this.getSupportedResolutions(
            displayConfig.resolutionConfigs,
        );
        const configs: IVideoConfiguration[] = [];

        /*
         * Find the smallest resolution that is at least equal to
         * the display resolution.
         */
        const bestResolution = this.findBestResolution(
            displayConfig,
            supportedResolutions,
        );

        if (bestResolution !== undefined) {
            const resolutionVideoConfigs = this.getVideoResolutionConfigs(
                bestResolution,
                displayConfig,
                true,
            );

            configs.push(...resolutionVideoConfigs);
        }

        /*
         * Find all resolutions smaller than the best resolution.
         */
        const smallerResolutions = this.findSmallerResolutions(
            bestResolution,
            supportedResolutions,
        );
        for (const smallResolution of smallerResolutions) {
            const resolutionVideoConfigs = this.getVideoResolutionConfigs(
                smallResolution,
                displayConfig,
                false,
            );
            configs.push(...resolutionVideoConfigs);
        }

        return configs;
    }

    public buildDisplayServices(
        displayConfig: NodeAndroidAutoDisplayConfig,
        events: ServiceEvents,
    ): Service[] {
        let inputIpcHandler;
        let videoIpcName;

        if (displayConfig.type === DisplayType.MAIN) {
            videoIpcName = AndroidAutoIpcNames.VIDEO;

            inputIpcHandler = this.ipcRegistry.registerIpcService<
                AndroidAutoInputService,
                AndroidAutoInputClient
            >(AndroidAutoIpcNames.INPUT);
        } else {
            videoIpcName = AndroidAutoIpcNames.CLUSTER_VIDEO;
        }

        const videoIpcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoVideoService,
            AndroidAutoVideoClient
        >(videoIpcName);

        const videoConfigs = this.getVideoConfigs(displayConfig);

        const videoService = new NodeVideoService(
            videoIpcHandler,
            videoConfigs,
            displayConfig.id,
            displayConfig.type,
            Array.from(videoConfigs.keys()),
            events,
        );

        const inputService = new NodeAutoInputService(
            inputIpcHandler,
            displayConfig.touch !== undefined && displayConfig.touch
                ? {
                      width: displayConfig.width,
                      height: displayConfig.height,
                      type: TouchScreenType.CAPACITIVE,
                  }
                : undefined,
            displayConfig.id,
            events,
        );

        return [inputService, videoService];
    }

    public buildServices(events: ServiceEvents): Service[] {
        const mediaStatusIpcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoMediaStatusService,
            AndroidAutoMediaStatusClient
        >(AndroidAutoIpcNames.MEDIA_STATUS);

        const sensorsBuilder = new NodeSensorsBuilder(
            this.config.sensorConfigs,
        );

        const sensorService = new SensorService(sensorsBuilder, events);

        const displayServices = [];
        for (const displayConfig of this.config.displayConfigs) {
            displayServices.push(
                ...this.buildDisplayServices(displayConfig, events),
            );
        }

        return [
            ...displayServices,
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
        ];
    }
}
