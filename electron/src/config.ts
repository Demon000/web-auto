import { ElectronWindowBuilderConfig } from './ElectronWindowBuilder';

export interface ElectronConfig {
    createAndroidAutoServer?: boolean;
    electronWindowBuilder: ElectronWindowBuilderConfig;
}
