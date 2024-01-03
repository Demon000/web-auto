import { type LoggingConfig } from '@web-auto/logging';
import type { AndroidAutoServerConfig } from '@web-auto/android-auto';
import type {
    IVideoConfiguration,
    IInputSourceService_TouchScreen,
} from '@web-auto/android-auto-proto/interfaces.js';
import type { NodeCryptorConfig } from './crypto/NodeCryptor.js';
import type { NodeSensorConfig } from './services/NodeSensorBuilder.js';
import type { TcpDeviceHandlerConfig } from './transport/TcpDeviceHandler.js';
import type { ElectronUsbDeviceHandlerConfig } from './transport/UsbDeviceHandler.js';
import type { ElectronBluetoothDeviceHandlerConfig } from './transport/bluetooth/BluetoothDeviceHandlerConfig.js';

export interface NodeAndroidAutoServerConfig extends AndroidAutoServerConfig {
    sensorConfigs: NodeSensorConfig[];
    cryptorConfig: NodeCryptorConfig;
    videoConfigs: IVideoConfiguration[];
    clusterVideoConfigs: IVideoConfiguration[];
    touchScreenConfig: IInputSourceService_TouchScreen;
    tcpDeviceHandlerConfig: TcpDeviceHandlerConfig;
    usbDeviceHandlerConfig: ElectronUsbDeviceHandlerConfig;
    bluetoothDeviceHandlerConfig?: ElectronBluetoothDeviceHandlerConfig;
}

export interface NodeCommonAndroidAutoConfig {
    logging: LoggingConfig;
    androidAuto?: NodeAndroidAutoServerConfig;
}
