import { IpcClientRegistry } from '@web-auto/common-ipc/renderer.js';
import { ElectronIpcClientRegistry } from '@web-auto/electron-ipc/renderer.js';
import { SocketIpcClientRegistry } from '@web-auto/socket-ipc/renderer.js';
import { CONFIG } from './config.js';

export let ipcClientRegistry: IpcClientRegistry;

try {
    ipcClientRegistry = new ElectronIpcClientRegistry(CONFIG.registryName);
} catch (err) {
    ipcClientRegistry = new SocketIpcClientRegistry(
        import.meta.env.VITE_SOCKET_IPC_CLIENT_HOST,
        parseInt(import.meta.env.VITE_SOCKET_IPC_CLIENT_PORT),
        CONFIG.registryName,
    );
}
