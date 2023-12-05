import { type ElectronWindowBuilderConfig } from './ElectronWindowBuilder.js';
import { type LoggingConfig } from '@web-auto/logging';
import type { ElectronAndroidAutoServerConfig } from './ElectronAndroidAutoServer.js';

export interface ElectronConfig {
    logging: LoggingConfig;
    androidAuto?: ElectronAndroidAutoServerConfig;
    electronWindowBuilder: ElectronWindowBuilderConfig;
}
