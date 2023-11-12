import { ITouchConfig, IVideoConfig } from '@web-auto/android-auto-proto';
import { ElectronWindowBuilderConfig } from './ElectronWindowBuilder';
import { ElectronTcpDeviceHandlerConfig } from './transport/ElectronTcpDeviceHandler';
import { LoggingConfig } from '@web-auto/logging';
import { AndroidAutoServerConfig } from '@web-auto/android-auto';

export interface AndroidAutoConfig {
    serverConfig: AndroidAutoServerConfig;
    videoConfigs: IVideoConfig[];
    touchScreenConfig: ITouchConfig;
    tcpDeviceHandlerConfig: ElectronTcpDeviceHandlerConfig;
}

export interface ElectronConfig {
    logging: LoggingConfig;
    androidAuto?: AndroidAutoConfig;
    electronWindowBuilder: ElectronWindowBuilderConfig;
}
