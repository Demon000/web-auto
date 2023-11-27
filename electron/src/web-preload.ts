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
    AndroidAutoRendererMethod.VIDEO_START,
    AndroidAutoRendererMethod.VIDEO_DATA,
    AndroidAutoRendererMethod.VIDEO_STOP,
    AndroidAutoRendererMethod.DEVICES_UPDATED,
]);

wireMainMethods<AndroidAutoMainMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoMainMethod.START,
    AndroidAutoMainMethod.SEND_INPUT_SERVICE_TOUCH,
    AndroidAutoMainMethod.CONNECT_DEVICE,
    AndroidAutoMainMethod.DISCONNECT_DEVICE,
]);

wireMainPromiseMethods<WebConfigMainMethods>(WEB_CONFIG_CHANNEL_NAME, [
    WebConfigMainMethod.CONFIG,
]);
