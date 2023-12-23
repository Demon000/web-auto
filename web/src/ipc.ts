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
import { SocketIpcClientRegistry } from '@web-auto/socket-ipc/renderer.js';

let androidAutoIpcClientRegistry;

try {
    androidAutoIpcClientRegistry = new ElectronIpcClientRegistry(
        ANDROID_AUTO_IPC_REGISTRY_NAME,
    );
} catch (err) {
    androidAutoIpcClientRegistry = new SocketIpcClientRegistry(
        import.meta.env.VITE_SOCKET_IPC_CLIENT_HOST,
        parseInt(import.meta.env.VITE_SOCKET_IPC_CLIENT_PORT),
        ANDROID_AUTO_IPC_REGISTRY_NAME,
    );
}

await androidAutoIpcClientRegistry.register();

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

export const androidAutoClusterVideoService =
    androidAutoIpcClientRegistry.registerIpcClient<
        AndroidAutoVideoClient,
        AndroidAutoVideoService
    >(AndroidAutoIpcNames.CLUSTER_VIDEO);

export const androidAutoMediaStatusService =
    androidAutoIpcClientRegistry.registerIpcClient<
        AndroidAutoMediaStatusClient,
        AndroidAutoMediaStatusService
    >(AndroidAutoIpcNames.MEDIA_STATUS);
