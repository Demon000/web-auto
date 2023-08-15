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

wireRendererMethods<AndroidAutoRendererMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoRendererMethod.VIDEO_DATA,
]);

wireMainMethods<AndroidAutoMainMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoMainMethod.START,
]);

wireMainPromiseMethods<AndroidAutoMainMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoMainMethod.START_PROMISE,
]);
