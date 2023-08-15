import { BrowserWindow } from 'electron';
import { MainCommuncationChannel } from '@web-auto/electron-ipc-node';
import {
    ANDROID_AUTO_CHANNEL_NAME,
    AndroidAutoMainMethods,
    AndroidAutoRendererMethods,
} from '@web-auto/electron-ipc-android-auto';

export class AndroidAutoCommuncationChannel extends MainCommuncationChannel<
    AndroidAutoMainMethods,
    AndroidAutoRendererMethods
> {
    public constructor(window: BrowserWindow) {
        super(ANDROID_AUTO_CHANNEL_NAME, window);
    }
}
