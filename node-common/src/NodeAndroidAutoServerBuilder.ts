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
import type { IVideoConfiguration } from '@web-auto/android-auto-proto/interfaces.js';

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

    private getResolutions(): VideoCodecResolutionType[] {
        return [
            VideoCodecResolutionType.VIDEO_720x1280,
            VideoCodecResolutionType.VIDEO_1080x1920,
            VideoCodecResolutionType.VIDEO_1440x2560,
            VideoCodecResolutionType.VIDEO_2160x3840,
            VideoCodecResolutionType.VIDEO_800x480,
            VideoCodecResolutionType.VIDEO_1280x720,
            VideoCodecResolutionType.VIDEO_1920x1080,
            VideoCodecResolutionType.VIDEO_2560x1440,
            VideoCodecResolutionType.VIDEO_3840x2160,
        ];
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

    private getMargins(
        displayConfig: NodeAndroidAutoDisplayConfig,
        width: number,
        height: number,
        scale: number,
    ): [number, number] {
        return [
            Math.round(Math.abs(width * scale - displayConfig.width) / scale),
            Math.round(Math.abs(height * scale - displayConfig.height) / scale),
        ];
    }

    private matchingResolutionConfig(
        resolution: VideoCodecResolutionType,
        resolutionConfigs: NodeAndroidAutoResolutionConfig[],
    ): VideoCodecResolutionType | undefined {
        for (const resolutionConfig of resolutionConfigs) {
            if (resolutionConfig.resolution === resolution) {
                return resolution;
            }
        }

        return undefined;
    }

    private findBestResolution(
        displayConfig: NodeAndroidAutoDisplayConfig,
    ): VideoCodecResolutionType | undefined {
        const resolutions = this.getResolutions();
        let bestResolution;

        for (const resolution of resolutions) {
            const [width, height] = this.resolutionToSize(resolution);

            if (width < displayConfig.width || height < displayConfig.height) {
                continue;
            }

            if (bestResolution !== undefined) {
                const [bestWidth, bestHeight] =
                    this.resolutionToSize(bestResolution);

                if (width >= bestWidth && height >= bestHeight) {
                    continue;
                }
            }

            bestResolution = this.matchingResolutionConfig(
                resolution,
                displayConfig.resolutionConfigs,
            );
        }

        return bestResolution;
    }

    private findSmallerResolutions(
        bigResolution: VideoCodecResolutionType | undefined,
        resolutionConfigs: NodeAndroidAutoResolutionConfig[],
    ): VideoCodecResolutionType[] {
        const resolutions = this.getResolutions();
        const foundResolutions = [];

        let bigWidth, bigHeight;
        if (bigResolution !== undefined) {
            [bigWidth, bigHeight] = this.resolutionToSize(bigResolution);
        }

        for (const resolution of resolutions) {
            if (resolution === bigResolution) {
                continue;
            }

            const [width, height] = this.resolutionToSize(resolution);

            if (
                bigWidth !== undefined &&
                bigHeight !== undefined &&
                (width >= bigWidth || height >= bigHeight)
            ) {
                continue;
            }

            const foundResolution = this.matchingResolutionConfig(
                resolution,
                resolutionConfigs,
            );

            if (foundResolution === undefined) {
                continue;
            }

            foundResolutions.push(foundResolution);
        }

        return foundResolutions;
    }

    private getVideoResolutionConfigs(
        resolution: VideoCodecResolutionType,
        displayConfig: NodeAndroidAutoDisplayConfig,
        cover: boolean,
    ): IVideoConfiguration[] {
        const configs: IVideoConfiguration[] = [];

        const [width, height] = this.resolutionToSize(resolution);

        const widthRatio = displayConfig.width / width;
        const heightRatio = displayConfig.height / height;

        const ratio = cover
            ? Math.max(widthRatio, heightRatio)
            : Math.min(widthRatio, heightRatio);

        const dpi = Math.round(displayConfig.density / ratio);

        const margins = this.getMargins(displayConfig, width, height, ratio);

        for (const resolutionConfig of displayConfig.resolutionConfigs) {
            if (resolution !== resolutionConfig.resolution) {
                continue;
            }

            configs.push({
                codecResolution: resolution,
                density: dpi,
                widthMargin: margins[0],
                heightMargin: margins[1],
                frameRate: resolutionConfig.framerate,
                videoCodecType: resolutionConfig.codec,
            });
        }

        return configs;
    }

    private getVideoConfigs(
        displayConfig: NodeAndroidAutoDisplayConfig,
    ): IVideoConfiguration[] {
        const configs: IVideoConfiguration[] = [];

        /*
         * Find the smallest resolution that is at least equal to
         * the display resolution.
         */
        const bestResolution = this.findBestResolution(displayConfig);

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
            displayConfig.resolutionConfigs,
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
