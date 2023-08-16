import {
    wireMainMethods,
    wireMainPromiseMethods,
    wireRendererMethods,
} from '@web-auto/electron-ipc-preload';
import {
    ANDROID_AUTO_CHANNEL_NAME,
    AndroidAutoMainMethod,
    AndroidAutoMainMethods,
    AndroidAutoRendererMethod,
    AndroidAutoRendererMethods,
} from '@web-auto/electron-ipc-android-auto';
import {
    WEB_CONFIG_CHANNEL_NAME,
    WebConfigMainMethod,
    WebConfigMainMethods,
} from '@web-auto/electron-ipc-web-config';

wireRendererMethods<AndroidAutoRendererMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoRendererMethod.VIDEO_DATA,
]);

wireMainMethods<AndroidAutoMainMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoMainMethod.START,
]);

wireMainPromiseMethods<WebConfigMainMethods>(WEB_CONFIG_CHANNEL_NAME, [
    WebConfigMainMethod.CONFIG,
]);
