import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAndroidAutoServer } from '../ElectronAndroidAutoServer';
import { ServiceFactory } from '@web-auto/server';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

const serviceFactory = new ServiceFactory(wss);
const androidAutoServer = new ElectronAndroidAutoServer();

contextBridge.exposeInMainWorld('api', {
    send: (channel: string, data: any) => {
        // whitelist channels
        const validChannels = ['toMain', 'did-finish-load'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel: string, func: Function) => {
        const validChannels = ['fromMain', 'main-process-message'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
});
