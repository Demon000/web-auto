import {
    AndroidAutoServer,
    Device,
    type AndroidAutoServerConfig,
    ControlService,
    Cryptor,
    DeviceHandler,
    Service,
    type ControlServiceEvents,
    type DeviceHandlerEvents,
    type ServiceEvents,
} from '@web-auto/android-auto';
import {
    AndroidAutoIpcNames,
    type AndroidAutoInputService,
    type AndroidAutoServerClient,
    type AndroidAutoServerService,
    type IDevice,
    type AndroidAutoInputClient,
    type AndroidAutoVideoService,
    type AndroidAutoVideoClient,
    type AndroidAutoMediaStatusService,
    type AndroidAutoMediaStatusClient,
} from '@web-auto/android-auto-ipc';
import { NodeMediaStatusService } from './services/NodeMediaStatusService.js';
import { NodeNavigationStatusService } from './services/NodeNavigationService.js';
import { DummySensorService } from './services/NodeSensorService.js';
import { NodeAudioInputService } from './services/NodeAudioInputService.js';
import { NodeAudioOutputService } from './services/NodeAudioOutputService.js';
import { NodeAutoInputService } from './services/NodeInputService.js';
import { NodeVideoService } from './services/NodeVideoService.js';
import {
    UsbDeviceHandler,
    type ElectronUsbDeviceHandlerConfig,
} from './transport/UsbDeviceHandler.js';
import {
    TcpDeviceHandler,
    type TcpDeviceHandlerConfig,
} from './transport/TcpDeviceHandler.js';
import { ElectronBluetoothDeviceHandler } from './transport/bluetooth/BluetoothDeviceHandler.js';
import { NodeCryptor, type NodeCryptorConfig } from './crypto/NodeCryptor.js';
import type { ElectronBluetoothDeviceHandlerConfig } from './transport/bluetooth/BluetoothDeviceHandlerConfig.js';
import { AudioStreamType } from '@web-auto/android-auto-proto';
import type {
    IInputSourceService_TouchScreen,
    IVideoConfiguration,
} from '@web-auto/android-auto-proto/interfaces.js';
import type {
    IpcServiceRegistry,
    IpcServiceHandler,
} from '@web-auto/common-ipc/main.js';

export interface NodeAndroidAutoServerConfig extends AndroidAutoServerConfig {
    cryptorConfig: NodeCryptorConfig;
    videoConfigs: IVideoConfiguration[];
    touchScreenConfig: IInputSourceService_TouchScreen;
    tcpDeviceHandlerConfig: TcpDeviceHandlerConfig;
    usbDeviceHandlerConfig: ElectronUsbDeviceHandlerConfig;
    bluetoothDeviceHandlerConfig?: ElectronBluetoothDeviceHandlerConfig;
}

export class NodeAndroidAutoServer extends AndroidAutoServer {
    private ipcHandler: IpcServiceHandler<
        AndroidAutoServerService,
        AndroidAutoServerClient
    >;

    public constructor(
        protected ipcRegistry: IpcServiceRegistry,
        protected override config: NodeAndroidAutoServerConfig,
    ) {
        super(config);

        this.ipcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoServerService,
            AndroidAutoServerClient
        >(AndroidAutoIpcNames.SERVER);

        this.ipcHandler.on(
            'connectDeviceName',
            this.connectDeviceName.bind(this),
        );
        this.ipcHandler.on(
            'disconnectDeviceName',
            this.disconnectDeviceName.bind(this),
        );

        this.ipcHandler.on('getDevices', this.getDevicesObjects.bind(this));
        this.ipcHandler.on(
            'getConnectedDevice',
            this.getConnectedDeviceObject.bind(this),
        );
    }

    protected buildDeviceHandlers(
        events: DeviceHandlerEvents,
    ): DeviceHandler[] {
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
    protected buildCryptor(
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ): Cryptor {
        return new NodeCryptor(
            this.config.cryptorConfig,
            certificateBuffer,
            privateKeyBuffer,
        );
    }
    protected buildControlService(
        cryptor: Cryptor,
        events: ControlServiceEvents,
    ): ControlService {
        return new ControlService(cryptor, this.config.controlConfig, events);
    }

    protected buildServices(events: ServiceEvents): Service[] {
        const inputIpcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoInputService,
            AndroidAutoInputClient
        >(AndroidAutoIpcNames.INPUT);

        const videoIpcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoVideoService,
            AndroidAutoVideoClient
        >(AndroidAutoIpcNames.VIDEO);

        const mediaStatusIpcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoMediaStatusService,
            AndroidAutoMediaStatusClient
        >(AndroidAutoIpcNames.MEDIA_STATUS);

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
            new DummySensorService(events),
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
        ];
    }

    protected deviceFromImpl(device: Device): IDevice {
        return {
            name: device.name,
            prefix: device.prefix,
            realName: device.realName,
            state: device.state,
        };
    }

    protected devicesFromImpl(devices: Device[]): IDevice[] {
        const ipcDevices: IDevice[] = [];
        for (const device of devices) {
            ipcDevices.push(this.deviceFromImpl(device));
        }

        return ipcDevices;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getDevicesObjects(): Promise<IDevice[]> {
        const devices = this.getDevices();
        return this.devicesFromImpl(devices);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getConnectedDeviceObject(): Promise<IDevice | undefined> {
        const device = this.getConnectedDevice();
        if (device === undefined) {
            return undefined;
        }

        return this.deviceFromImpl(device);
    }

    public async connectDeviceName(name: string): Promise<void> {
        const device = this.getDeviceByName(name);
        if (device === undefined) {
            throw new Error(`Unknown device ${name}`);
        }

        await this.connectDeviceAsync(device);
    }

    public async disconnectDeviceName(name: string): Promise<void> {
        const device = this.getDeviceByName(name);
        if (device === undefined) {
            throw new Error(`Unknown device ${name}`);
        }

        await this.disconnectDeviceAsync(device);
    }

    protected onDevicesUpdatedCallback(devices: Device[]): void {
        const ipcDevices = this.devicesFromImpl(devices);
        this.ipcHandler.devices(ipcDevices);
    }

    protected onDeviceDisconnectedCallback(): void {
        this.ipcHandler.deviceDisconnected();
    }
    protected onDeviceConnectedCallback(device: Device): void {
        this.ipcHandler.deviceConnected(this.deviceFromImpl(device));
    }
}
