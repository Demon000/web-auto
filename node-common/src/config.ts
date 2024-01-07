import { type LoggingConfig } from '@web-auto/logging';
import type { NodeCryptorConfig } from './crypto/NodeCryptor.js';
import type { NodeSensorConfig } from './services/NodeSensorBuilder.js';
import type { TcpDeviceHandlerConfig } from './transport/TcpDeviceHandler.js';
import type { ElectronUsbDeviceHandlerConfig } from './transport/UsbDeviceHandler.js';
import type { ElectronBluetoothDeviceHandlerConfig } from './transport/bluetooth/BluetoothDeviceHandlerConfig.js';
import type {
    DisplayType,
    MediaCodecType,
    VideoCodecResolutionType,
    VideoFrameRateType,
} from '@web-auto/android-auto-proto';
import type { ControlServiceConfig } from '@web-auto/android-auto';
import type {
    IHeadUnitInfo,
    IServiceDiscoveryResponse,
} from '@web-auto/android-auto-proto/interfaces.js';

export interface NodeAndroidAutoResolutionConfig {
    codec: MediaCodecType;
    resolution: VideoCodecResolutionType;
    framerate: VideoFrameRateType;
}

export interface NodeAndroidAutoDisplayConfig {
    id: number;
    width: number;
    height: number;
    touch?: boolean;
    type: DisplayType;
    density: number;
    resolutionConfigs: NodeAndroidAutoResolutionConfig[];
}

export interface NodeAndroidAutoServerConfig {
    controlConfig: ControlServiceConfig;
    headunitInfo: IHeadUnitInfo;
    serviceDiscoveryResponse: IServiceDiscoveryResponse;
    displayConfigs: NodeAndroidAutoDisplayConfig[];
    sensorConfigs: NodeSensorConfig[];
    cryptorConfig: NodeCryptorConfig;
    tcpDeviceHandlerConfig: TcpDeviceHandlerConfig;
    usbDeviceHandlerConfig: ElectronUsbDeviceHandlerConfig;
    bluetoothDeviceHandlerConfig?: ElectronBluetoothDeviceHandlerConfig;
}

export interface NodeCommonAndroidAutoConfig {
    logging: LoggingConfig;
    androidAuto?: NodeAndroidAutoServerConfig;
}
