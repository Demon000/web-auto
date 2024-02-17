import { type LoggingConfig } from '@web-auto/logging';
import type { NodeCryptorConfig } from './crypto/NodeCryptor.js';
import type { NodeSensorConfig } from './services/NodeSensorBuilder.js';
import type { TcpDeviceHandlerConfig } from './transport/tcp/TcpDeviceHandler.js';
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
import type { BluetoothDeviceHandlerConfig } from './transport/bluetooth/BluetoothDeviceHandler.js';

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
    touchEventThrottlePixels?: number;
    type: DisplayType;
    density: number;
    resolutionConfigs: NodeAndroidAutoResolutionConfig[];
}

export interface NodeAndroidAutoServerConfig {
    ignoredDevices?: string[];
    controlConfig: ControlServiceConfig;
    headunitInfo: IHeadUnitInfo;
    serviceDiscoveryResponse: IServiceDiscoveryResponse;
    displayConfigs: NodeAndroidAutoDisplayConfig[];
    sensorConfigs: NodeSensorConfig[];
    cryptorConfig: NodeCryptorConfig;
    tcpDeviceHandlerConfig: TcpDeviceHandlerConfig;
    bluetoothDeviceHandlerConfig?: BluetoothDeviceHandlerConfig;
}

export interface NodeCommonAndroidAutoConfig {
    logging: LoggingConfig;
    androidAuto?: NodeAndroidAutoServerConfig;
}
