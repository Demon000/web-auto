import { IpcClientRegistry } from '@web-auto/common-ipc/renderer.js';
import { ElectronIpcClientRegistry } from '@web-auto/electron-ipc/renderer.js';
import { SocketIpcClientRegistry } from '@web-auto/socket-ipc/renderer.js';
import { CONFIG } from './config.js';

export let ipcClientRegistry: IpcClientRegistry;

try {
    ipcClientRegistry = new ElectronIpcClientRegistry(CONFIG.registryName);
} catch (err) {
    ipcClientRegistry = new SocketIpcClientRegistry(
        CONFIG.nodeAndroidAuto.webSocketServer.host,
        CONFIG.nodeAndroidAuto.webSocketServer.port,
        CONFIG.registryName,
    );
}
