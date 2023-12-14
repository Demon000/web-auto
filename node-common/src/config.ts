import { type LoggingConfig } from '@web-auto/logging';
import type { NodeAndroidAutoServerConfig } from './NodeAndroidAutoServer.js';

export interface NodeCommonAndroidAutoConfig {
    logging: LoggingConfig;
    androidAuto?: NodeAndroidAutoServerConfig;
}
