import {
    wireMainMethods,
    wireMainPromiseMethods,
    wireRendererMethods,
} from '@electron/preload/ipc';
import {
    ANDROID_AUTO_CHANNEL_NAME,
    AndroidAutoMainMethod,
    AndroidAutoMainMethods,
    AndroidAutoRendererMethod,
    AndroidAutoRendererMethods,
} from '@shared/ipc';

wireRendererMethods<AndroidAutoRendererMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoRendererMethod.VIDEO_DATA,
]);

wireMainMethods<AndroidAutoMainMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoMainMethod.START,
]);

wireMainPromiseMethods<AndroidAutoMainMethods>(ANDROID_AUTO_CHANNEL_NAME, [
    AndroidAutoMainMethod.START_PROMISE,
]);
