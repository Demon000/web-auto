import {
    ControlService,
    Cryptor,
    DeviceHandler,
    Service,
    type AndroidAutoServerBuilder,
    type ControlServiceEvents,
    type DeviceHandlerEvents,
    type ServiceEvents,
} from '@web-auto/android-auto';
import {
    type AndroidAutoVideoService,
    type AndroidAutoVideoClient,
    type AndroidAutoMediaStatusService,
    type AndroidAutoMediaStatusClient,
    type AndroidAutoServerClient,
    type AndroidAutoServerService,
    type AndroidAutoInputClient,
    type AndroidAutoInputService,
} from '@web-auto/android-auto-ipc';
import { NodeCryptor } from './crypto/NodeCryptor.js';
import { OpenSSLCryptor } from './crypto/OpenSSLCryptor.js';
import { NodeAudioInputService } from './services/NodeAudioInputService.js';
import { NodeAudioOutputService } from './services/NodeAudioOutputService.js';
import { NodeInputService } from './services/NodeInputService.js';
import { NodeMediaStatusService } from './services/NodeMediaStatusService.js';
import { NodeNavigationStatusService } from './services/NodeNavigationService.js';
import { NodeSensorService } from './services/NodeSensorService.js';
import { NodeVideoService } from './services/NodeVideoService.js';
import { TcpDeviceHandler } from './transport/tcp/TcpDeviceHandler.js';
import { UsbDeviceHandler } from './transport/usb/UsbDeviceHandler.js';
import { BluetoothDeviceHandler } from './transport/bluetooth/BluetoothDeviceHandler.js';
import type { IpcServiceRegistry } from '@web-auto/common-ipc/main.js';
import { getLogger } from '@web-auto/logging';
import type { NodeAndroidAutoServerConfig } from './config.js';
import { NodeAndroidAutoServer } from './NodeAndroidAutoServer.js';
import { NodeRtAudioInputService } from './services/NodeRtAudioInputService.js';
import { NodeRtAudioOutputService } from './services/NodeRtAudioOutputService.js';

export class NodeAndroidAutoServerBuilder implements AndroidAutoServerBuilder {
    protected logger = getLogger(this.constructor.name);

    public constructor(
        protected ipcRegistry: IpcServiceRegistry,
        protected config: NodeAndroidAutoServerConfig,
    ) {}

    public buildAndroidAutoServer(): NodeAndroidAutoServer {
        const ipcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoServerService,
            AndroidAutoServerClient
        >(this.config.serverIpcName);
        return new NodeAndroidAutoServer(this, ipcHandler);
    }

    public buildDeviceHandlers(events: DeviceHandlerEvents): DeviceHandler[] {
        const deviceHandlers: DeviceHandler[] = [];
        for (const entry of this.config.deviceHandlers) {
            let deviceHandler;

            switch (entry.name) {
                case 'UsbDeviceHandler':
                    deviceHandler = new UsbDeviceHandler(
                        entry,
                        this.config.ignoredDevices,
                        events,
                    );
                    break;
                case 'BluetoothDeviceHandler':
                    deviceHandler = new BluetoothDeviceHandler(
                        entry,
                        this.config.ignoredDevices,
                        events,
                    );
                    break;
                case 'TcpDeviceHandler':
                    deviceHandler = new TcpDeviceHandler(
                        entry,
                        this.config.ignoredDevices,
                        events,
                    );
                    break;
            }

            deviceHandlers.push(deviceHandler);
        }

        return deviceHandlers;
    }

    public buildCryptor(
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ): Cryptor {
        switch (this.config.cryptor.name) {
            case 'NodeCryptor':
                return new NodeCryptor(
                    this.config.cryptor,
                    certificateBuffer,
                    privateKeyBuffer,
                );
            case 'OpenSSLCryptor':
                return new OpenSSLCryptor(certificateBuffer, privateKeyBuffer);
        }
    }

    public buildControlService(
        cryptor: Cryptor,
        events: ControlServiceEvents,
    ): ControlService {
        switch (this.config.controlService.name) {
            case 'ControlService':
                return new ControlService(
                    cryptor,
                    this.config.controlService,
                    events,
                );
        }
    }

    public buildServices(events: ServiceEvents): Service[] {
        const services: Service[] = [];

        for (const entry of this.config.services) {
            let ipcHandler;
            let service;

            switch (entry.name) {
                case 'NodeSensorService':
                    service = new NodeSensorService(entry, events);
                    break;
                case 'NodeAudioInputService':
                    service = new NodeAudioInputService(entry, events);
                    break;
                case 'NodeRtAudioInputService':
                    service = new NodeRtAudioInputService(entry, events);
                    break;
                case 'NodeAudioOutputService':
                    service = new NodeAudioOutputService(entry, events);
                    break;
                case 'NodeRtAudioOutputService':
                    service = new NodeRtAudioOutputService(entry, events);
                    break;
                case 'NodeVideoService':
                    ipcHandler = this.ipcRegistry.registerIpcService<
                        AndroidAutoVideoService,
                        AndroidAutoVideoClient
                    >(entry.ipcName);
                    service = new NodeVideoService(ipcHandler, entry, events);
                    break;
                case 'NodeInputService':
                    ipcHandler = this.ipcRegistry.registerIpcService<
                        AndroidAutoInputService,
                        AndroidAutoInputClient
                    >(entry.ipcName);
                    service = new NodeInputService(ipcHandler, entry, events);
                    break;
                case 'NodeMediaStatusService':
                    ipcHandler = this.ipcRegistry.registerIpcService<
                        AndroidAutoMediaStatusService,
                        AndroidAutoMediaStatusClient
                    >(entry.ipcName);
                    service = new NodeMediaStatusService(ipcHandler, events);
                    break;
                case 'NodeNavigationStatusService':
                    service = new NodeNavigationStatusService(events);
                    break;
            }

            services.push(service);
        }

        return services;
    }
}
