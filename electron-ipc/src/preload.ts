import { contextBridge, ipcRenderer } from 'electron';
import {
    ELECTRON_IPC_COMMUNICATION_CHANNEL,
    type IpcPreloadExposed,
} from './common.js';

export const expose = () => {
    const exposed: IpcPreloadExposed = {
        on: (name, cb) => ipcRenderer.on(name, cb),
        off: (name, cb) => ipcRenderer.off(name, cb),
        invoke: (name, ipcEvent) => ipcRenderer.invoke(name, ipcEvent),
        send: (name, ipcEvent) => ipcRenderer.send(name, ipcEvent),
    };

    contextBridge.exposeInMainWorld(
        ELECTRON_IPC_COMMUNICATION_CHANNEL,
        exposed,
    );
};
