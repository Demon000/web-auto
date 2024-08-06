import {
    type AndroidAutoServerBuilder,
    ControlService,
    type ControlServiceEvents,
    Cryptor,
    DeviceHandler,
    type DeviceHandlerEvents,
    Service,
    type ServiceEvents,
} from '@web-auto/android-auto';
import type { IpcServiceRegistry } from '@web-auto/common-ipc/main.js';
import { getLogger } from '@web-auto/logging';

import type { NodeAndroidAutoServerConfig } from './config.js';
import { NodeCryptor } from './crypto/NodeCryptor.js';
import { OpenSSLCryptor } from './crypto/OpenSSLCryptor.js';
import {
    type AndroidAutoServerClient,
    type AndroidAutoServerService,
    NodeAndroidAutoServer,
} from './NodeAndroidAutoServer.js';
import { NodeAudioInputService } from './services/NodeAudioInputService.js';
import {
    type AndroidAutoAudioOutputClient,
    type AndroidAutoAudioOutputService,
    NodeAudioOutputService,
} from './services/NodeAudioOutputService.js';
import type {
    AndroidAutoBrightnessClient,
    AndroidAutoBrightnessService,
} from './services/NodeBrightnessService.js';
import { NodeDdcBrightnessService } from './services/NodeDdcBrightnessService.js';
import {
    type AndroidAutoInputClient,
    type AndroidAutoInputService,
    NodeInputService,
} from './services/NodeInputService.js';
import {
    type AndroidAutoMediaStatusClient,
    type AndroidAutoMediaStatusService,
    NodeMediaStatusService,
} from './services/NodeMediaStatusService.js';
import { NodeNavigationStatusService } from './services/NodeNavigationService.js';
import { NodeRtAudioInputService } from './services/NodeRtAudioInputService.js';
import { NodeRtAudioOutputService } from './services/NodeRtAudioOutputService.js';
import { NodeSensorService } from './services/NodeSensorService.js';
import {
    type AndroidAutoVideoClient,
    type AndroidAutoVideoService,
    NodeVideoService,
} from './services/NodeVideoService.js';
import { BluetoothDeviceHandler } from './transport/bluetooth/BluetoothDeviceHandler.js';
import { TcpDeviceHandler } from './transport/tcp/TcpDeviceHandler.js';
import { UsbDeviceHandler } from './transport/usb/UsbDeviceHandler.js';

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

    public async buildDeviceHandlers(
        events: DeviceHandlerEvents,
    ): Promise<DeviceHandler[]> {
        const deviceHandlers: DeviceHandler[] = [];
        for (const entry of this.config.deviceHandlers) {
            let deviceHandler;

            switch (entry.name) {
                case 'UsbDeviceHandler':
                    deviceHandler = new UsbDeviceHandler(entry, events);
                    break;
                case 'BluetoothDeviceHandler':
                    deviceHandler = await BluetoothDeviceHandler.create(
                        entry,
                        events,
                    );
                    break;
                case 'TcpDeviceHandler':
                    deviceHandler = new TcpDeviceHandler(entry, events);
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
                    ipcHandler = this.ipcRegistry.registerIpcService<
                        AndroidAutoAudioOutputService,
                        AndroidAutoAudioOutputClient
                    >(entry.ipcName);
                    service = new NodeAudioOutputService(
                        ipcHandler,
                        entry,
                        events,
                    );
                    break;
                case 'NodeRtAudioOutputService':
                    ipcHandler = this.ipcRegistry.registerIpcService<
                        AndroidAutoAudioOutputService,
                        AndroidAutoAudioOutputClient
                    >(entry.ipcName);
                    service = new NodeRtAudioOutputService(
                        ipcHandler,
                        entry,
                        events,
                    );
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
                case 'NodeDdcBrightnessService':
                    ipcHandler = this.ipcRegistry.registerIpcService<
                        AndroidAutoBrightnessService,
                        AndroidAutoBrightnessClient
                    >(entry.ipcName);
                    service = new NodeDdcBrightnessService(
                        entry,
                        ipcHandler,
                        events,
                    );
                    break;
            }

            services.push(service);
        }

        return services;
    }
}
