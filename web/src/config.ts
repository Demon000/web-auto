import { NodeAndroidAutoConfig } from '@web-auto/node';
import { DecoderWorkerConfig } from './codec/DecoderWorkerWrapper.js';
import { AppBarProps } from './components/AppBar.vue';

export type WebAndroidAutoConfig = {
    web: {
        registryName: string;
        themeColor: string;
        decoders: DecoderWorkerConfig[];
        appBar: AppBarProps;
        views: {
            path: string;
            component: string;
        }[];
    };
} & NodeAndroidAutoConfig;

export const CONFIG = import.meta.env.CONFIG as WebAndroidAutoConfig;
export const WEB_CONFIG = CONFIG.web;
