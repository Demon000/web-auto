import {
    CommunicationChannel,
    MethodsMap,
    composeName,
} from '@web-auto/electron-ipc';
import { BrowserWindow, ipcMain } from 'electron';

export class MainCommuncationChannel<
    L extends MethodsMap,
    R extends MethodsMap,
> extends CommunicationChannel<L, R> {
    public constructor(
        name: string,
        private window: BrowserWindow,
    ) {
        super(name);
    }

    public send<K extends keyof R & string>(
        eventName: K,
        ...args: Parameters<R[K]>
    ): void {
        const name = composeName(this.name, eventName);
        this.window.webContents.send(name, ...args);
    }

    public on<K extends keyof L & string>(eventName: K, callback: L[K]): void {
        const name = composeName(this.name, eventName);
        ipcMain.on(name, (_event, ...args) => {
            callback(...args);
        });
    }

    public handle<K extends keyof L & string>(
        eventName: K,
        callback: L[K],
    ): void {
        const name = composeName(this.name, eventName);
        ipcMain.handle(name, (_event, ...args) => {
            callback(...args);
        });
    }
}
