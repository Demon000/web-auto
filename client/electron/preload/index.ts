import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    send: (channel: string, data: any) => {
        // whitelist channels
        let validChannels = ['toMain', 'did-finish-load'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel: string, func: Function) => {
        let validChannels = ['fromMain', 'main-process-message'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
});
