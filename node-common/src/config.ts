import type { ControlServiceConfig } from '@web-auto/android-auto';
import { type LoggingConfig } from '@web-auto/logging';

import type { NodeCryptorConfig } from './crypto/NodeCryptor.js';
import type { NodeAudioInputServiceConfig } from './services/NodeAudioInputService.js';
import type { NodeAudioOutputServiceConfig } from './services/NodeAudioOutputService.js';
import type { NodeDdcBrightnessServiceConfig } from './services/NodeDdcBrightnessService.js';
import type { NodeInputServiceConfig } from './services/NodeInputService.js';
import type { NodeRtAudioInputServiceConfig } from './services/NodeRtAudioInputService.js';
import type { NodeRtAudioOutputServiceConfig } from './services/NodeRtAudioOutputService.js';
import type { NodeSensorServiceConfig } from './services/NodeSensorService.js';
import type { NodeVideoServiceConfig } from './services/NodeVideoService.js';
import type { BluetoothDeviceHandlerConfig } from './transport/bluetooth/BluetoothDeviceHandler.js';
import type { TcpDeviceHandlerConfig } from './transport/tcp/TcpDeviceHandler.js';
import type { UsbDeviceHandlerConfig } from './transport/usb/UsbDeviceHandler.js';

export interface NodeAndroidAutoServerConfig {
    serverIpcName: string;
    deviceHandlers: (
        | ({ name: 'UsbDeviceHandler' } & UsbDeviceHandlerConfig)
        | ({ name: 'TcpDeviceHandler' } & TcpDeviceHandlerConfig)
        | ({ name: 'BluetoothDeviceHandler' } & BluetoothDeviceHandlerConfig)
    )[];
    cryptor:
        | ({
              name: 'NodeCryptor';
          } & NodeCryptorConfig)
        | { name: 'OpenSSLCryptor' };
    controlService: {
        name: 'ControlService';
    } & ControlServiceConfig;
    services: (
        | ({
              name: 'NodeSensorService';
          } & NodeSensorServiceConfig)
        | ({
              name: 'NodeAudioInputService';
          } & NodeAudioInputServiceConfig)
        | ({
              name: 'NodeRtAudioInputService';
          } & NodeRtAudioInputServiceConfig)
        | ({
              name: 'NodeAudioOutputService';
              ipcName: string;
          } & NodeAudioOutputServiceConfig)
        | ({
              name: 'NodeRtAudioOutputService';
              ipcName: string;
          } & NodeRtAudioOutputServiceConfig)
        | ({
              name: 'NodeVideoService';
              ipcName: string;
          } & NodeVideoServiceConfig)
        | ({
              name: 'NodeInputService';
              ipcName: string;
          } & NodeInputServiceConfig)
        | { name: 'NodeNavigationStatusService' }
        | { name: 'NodeMediaStatusService'; ipcName: string }
        | ({
              name: 'NodeDdcBrightnessService';
              ipcName: string;
          } & NodeDdcBrightnessServiceConfig)
    )[];
}

export interface NodeCommonAndroidAutoConfig {
    registryName: string;
    logging: LoggingConfig;
    androidAuto?: NodeAndroidAutoServerConfig;
}
