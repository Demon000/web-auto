import { WebConfig } from '@web-auto/web-config';

export const WEB_CONFIG_CHANNEL_NAME = 'config';

export interface WebConfigRendererMethods {}

export enum WebConfigMainMethod {
    CONFIG = 'config',
}

export interface WebConfigMainMethods {
    [WebConfigMainMethod.CONFIG]: () => Promise<WebConfig>;
}
