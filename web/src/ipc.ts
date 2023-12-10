import {
    AndroidAutoIpcNames,
    type AndroidAutoInputClient,
    type AndroidAutoInputService,
    type AndroidAutoVideoClient,
    type AndroidAutoVideoService,
    type AndroidAutoServerService,
    type AndroidAutoServerClient,
    ANDROID_AUTO_IPC_REGISTRY_NAME,
    AndroidAutoMediaStatusClient,
    AndroidAutoMediaStatusService,
} from '@web-auto/android-auto-ipc';
import { ElectronIpcClientRegistry } from '@web-auto/electron-ipc/renderer.js';

const androidAutoIpcClientRegistry = new ElectronIpcClientRegistry(
    ANDROID_AUTO_IPC_REGISTRY_NAME,
);

androidAutoIpcClientRegistry.register();

export const androidAutoServerService =
    androidAutoIpcClientRegistry.registerIpcClient<
        AndroidAutoServerClient,
        AndroidAutoServerService
    >(AndroidAutoIpcNames.SERVER);

export const androidAutoInputService =
    androidAutoIpcClientRegistry.registerIpcClient<
        AndroidAutoInputClient,
        AndroidAutoInputService
    >(AndroidAutoIpcNames.INPUT);

export const androidAutoVideoService =
    androidAutoIpcClientRegistry.registerIpcClient<
        AndroidAutoVideoClient,
        AndroidAutoVideoService
    >(AndroidAutoIpcNames.VIDEO);

export const androidAutoMediaStatusService =
    androidAutoIpcClientRegistry.registerIpcClient<
        AndroidAutoMediaStatusClient,
        AndroidAutoMediaStatusService
    >(AndroidAutoIpcNames.MEDIA_STATUS);
