import {
    wireMainMethods,
    wireMainPromiseMethods,
    wireRendererMethods,
} from '@web-auto/electron-ipc/preload.js';
import {
    ANDROID_AUTO_CHANNEL_NAME,
    AndroidAutoMainMethod,
    type AndroidAutoMainMethods,
    AndroidAutoRendererMethod,
    type AndroidAutoRendererMethods,
} from '@web-auto/electron-ipc-android-auto';
import {
    WEB_CONFIG_CHANNEL_NAME,
    WebConfigMainMethod,
    type WebConfigMainMethods,
} from '@web-auto/electron-ipc-web-config';

wireRendererMethods<AndroidAutoRendererMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoRendererMethod.VIDEO_START,
    AndroidAutoRendererMethod.VIDEO_DATA,
    AndroidAutoRendererMethod.VIDEO_STOP,
    AndroidAutoRendererMethod.DEVICES_UPDATED,
]);

wireMainMethods<AndroidAutoMainMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoMainMethod.START,
    AndroidAutoMainMethod.SEND_INPUT_SERVICE_TOUCH,
]);

wireMainPromiseMethods<AndroidAutoMainMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoMainMethod.CONNECT_DEVICE,
    AndroidAutoMainMethod.DISCONNECT_DEVICE,
]);

wireMainPromiseMethods<WebConfigMainMethods>(WEB_CONFIG_CHANNEL_NAME, [
    WebConfigMainMethod.CONFIG,
]);
