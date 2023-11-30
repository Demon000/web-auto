import { ITouchConfig, IVideoConfig } from '@web-auto/android-auto-proto';
import { ElectronWindowBuilderConfig } from './ElectronWindowBuilder';
import { ElectronTcpDeviceHandlerConfig } from './transport/ElectronTcpDeviceHandler';
import { LoggingConfig } from '@web-auto/logging';
import {
    AndroidAutoServerConfig,
    ControlServiceConfig,
} from '@web-auto/android-auto';
import { ElectronBluetoothDeviceHandlerConfig } from './transport/bluetooth/ElectronBluetoothDeviceHandlerConfig';
import { ElectronUsbDeviceHandlerConfig } from './transport/ElectronUsbDeviceHandler';

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
