import { BrowserWindow } from 'electron';
import { MainCommuncationChannel } from '@web-auto/electron-ipc-main';
import {
    WEB_CONFIG_CHANNEL_NAME,
    WebConfigMainMethods,
    WebConfigRendererMethods,
} from '@web-auto/electron-ipc-web-config';

export class WebConfigCommuncationChannel extends MainCommuncationChannel<
    WebConfigMainMethods,
    WebConfigRendererMethods
> {
    public constructor(window: BrowserWindow) {
        super(WEB_CONFIG_CHANNEL_NAME, window);
    }
}
