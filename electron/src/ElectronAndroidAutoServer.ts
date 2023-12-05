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
} from '@web-auto/android-auto-ipc';
import {
    AudioType,
    type ITouchConfig,
    type IVideoConfig,
} from '@web-auto/android-auto-proto';
import { DummyMediaStatusService } from './services/DummyMediaStatusService.js';
import { DummyNavigationStatusService } from './services/DummyNavigationService.js';
import { DummySensorService } from './services/DummySensorService.js';
import { ElectronAndroidAutoAudioInputService } from './services/ElectronAndroidAutoAudioInputService.js';
import { ElectronAndroidAutoAudioOutputService } from './services/ElectronAndroidAutoAudioOutputService.js';
import { ElectronAndroidAutoInputService } from './services/ElectronAndroidAutoInputService.js';
import { ElectronAndroidAutoVideoService } from './services/ElectronAndroidAutoVideoService.js';
import {
    ElectronUsbDeviceHandler,
    type ElectronUsbDeviceHandlerConfig,
} from './transport/ElectronUsbDeviceHandler.js';
import {
    ElectronTcpDeviceHandler,
    type ElectronTcpDeviceHandlerConfig,
} from './transport/ElectronTcpDeviceHandler.js';
import { ElectronBluetoothDeviceHandler } from './transport/bluetooth/ElectronBluetoothDeviceHandler.js';
import { NodeCryptor } from './crypto/NodeCryptor.js';
import type { ElectronBluetoothDeviceHandlerConfig } from './transport/bluetooth/ElectronBluetoothDeviceHandlerConfig.js';
import {
    type IpcServiceHandler,
    type IpcServiceRegistry,
} from '@web-auto/electron-ipc/common.js';

export interface ElectronAndroidAutoServerConfig
    extends AndroidAutoServerConfig {
    videoConfigs: IVideoConfig[];
    touchScreenConfig: ITouchConfig;
    tcpDeviceHandlerConfig: ElectronTcpDeviceHandlerConfig;
    usbDeviceHandlerConfig: ElectronUsbDeviceHandlerConfig;
    bluetoothDeviceHandlerConfig?: ElectronBluetoothDeviceHandlerConfig;
}

export class ElectronAndroidAutoServer extends AndroidAutoServer {
    private ipcHandler: IpcServiceHandler<
        AndroidAutoServerService,
        AndroidAutoServerClient
    >;

    public constructor(
        protected ipcRegistry: IpcServiceRegistry,
        protected config: ElectronAndroidAutoServerConfig,
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
    }

    protected buildDeviceHandlers(
        events: DeviceHandlerEvents,
    ): DeviceHandler[] {
        const deviceHandlers: DeviceHandler[] = [
            new ElectronUsbDeviceHandler(
                this.config.usbDeviceHandlerConfig,
                events,
            ),
            new ElectronTcpDeviceHandler(
                this.config.tcpDeviceHandlerConfig,
                events,
            ),
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
        return new NodeCryptor(certificateBuffer, privateKeyBuffer);
    }
    protected buildControlService(
        events: ControlServiceEvents,
    ): ControlService {
        return new ControlService(this.config.controlConfig, events);
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

        return [
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
            new DummyNavigationStatusService(events),
            new DummyMediaStatusService(events),
            new ElectronAndroidAutoInputService(
                inputIpcHandler,
                this.config.touchScreenConfig,
                events,
            ),
            new ElectronAndroidAutoVideoService(
                videoIpcHandler,
                this.config.videoConfigs,
                events,
            ),
        ];
    }

    protected onDevicesUpdated(devices: Device[]): void {
        const ipcDevices: IDevice[] = [];
        for (const device of devices) {
            ipcDevices.push({
                name: device.name,
                prefix: device.prefix,
                realName: device.realName,
                state: device.state,
            });
        }

        this.ipcHandler.devices(ipcDevices);
    }
}