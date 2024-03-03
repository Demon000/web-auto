import { NodeAndroidAutoConfig } from '@web-auto/node';

export type WebAndroidAutoConfig = {
    web: {
        videoDecoderRenderer: string;
    };
} & NodeAndroidAutoConfig;
