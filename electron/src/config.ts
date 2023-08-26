import { ITouchConfig, IVideoConfig } from '@web-auto/android-auto-proto';
import { ElectronWindowBuilderConfig } from './ElectronWindowBuilder';

export interface AndroidAutoConfig {
    videoConfigs: IVideoConfig[];
    touchScreenConfig: ITouchConfig;
}

export interface ElectronConfig {
    androidAuto?: AndroidAutoConfig;
    electronWindowBuilder: ElectronWindowBuilderConfig;
}
