import {
    type ITouchConfig,
    type IVideoConfig,
} from '@web-auto/android-auto-proto';
import { type ElectronWindowBuilderConfig } from './ElectronWindowBuilder.js';
import { type ElectronTcpDeviceHandlerConfig } from './transport/ElectronTcpDeviceHandler.js';
import { type LoggingConfig } from '@web-auto/logging';
import {
    type AndroidAutoServerConfig,
    type ControlServiceConfig,
} from '@web-auto/android-auto';
import { type ElectronBluetoothDeviceHandlerConfig } from './transport/bluetooth/ElectronBluetoothDeviceHandlerConfig.js';
import { type ElectronUsbDeviceHandlerConfig } from './transport/ElectronUsbDeviceHandler.js';

export interface AndroidAutoConfig {
    serverConfig: AndroidAutoServerConfig;
    controlConfig: ControlServiceConfig;
    videoConfigs: IVideoConfig[];
    touchScreenConfig: ITouchConfig;
    tcpDeviceHandlerConfig: ElectronTcpDeviceHandlerConfig;
    usbDeviceHandlerConfig: ElectronUsbDeviceHandlerConfig;
    bluetoothDeviceHandlerConfig?: ElectronBluetoothDeviceHandlerConfig;
}

export interface ElectronConfig {
    logging: LoggingConfig;
    androidAuto?: AndroidAutoConfig;
    electronWindowBuilder: ElectronWindowBuilderConfig;
}
