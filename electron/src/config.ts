import { ITouchConfig, IVideoConfig } from '@web-auto/android-auto-proto';
import { ElectronWindowBuilderConfig } from './ElectronWindowBuilder';
import { ElectronTcpDeviceHandlerConfig } from './transport/ElectronTcpDeviceHandler';

export interface AndroidAutoConfig {
    videoConfigs: IVideoConfig[];
    touchScreenConfig: ITouchConfig;
    tcpDeviceHandlerConfig: ElectronTcpDeviceHandlerConfig;
}

export interface ElectronConfig {
    androidAuto?: AndroidAutoConfig;
    electronWindowBuilder: ElectronWindowBuilderConfig;
}
