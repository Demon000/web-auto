import { RendererCommuncationChannel } from '@web-auto/electron-ipc-renderer';
import {
    ANDROID_AUTO_CHANNEL_NAME,
    type AndroidAutoMainMethods,
    type AndroidAutoRendererMethods,
} from '@web-auto/electron-ipc-android-auto';

export class AndroidAutoCommuncationChannel extends RendererCommuncationChannel<
    AndroidAutoRendererMethods,
    AndroidAutoMainMethods
> {
    public constructor() {
        super(ANDROID_AUTO_CHANNEL_NAME);
    }
}
