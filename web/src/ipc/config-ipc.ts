import { RendererCommuncationChannel } from '@web-auto/electron-ipc-renderer';
import {
    WEB_CONFIG_CHANNEL_NAME,
    type WebConfigMainMethods,
    type WebConfigRendererMethods,
} from '@web-auto/electron-ipc-web-config';

export class WebConfigCommuncationChannel extends RendererCommuncationChannel<
    WebConfigRendererMethods,
    WebConfigMainMethods
> {
    public constructor() {
        super(WEB_CONFIG_CHANNEL_NAME);
    }
}
