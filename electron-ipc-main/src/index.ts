import {
    CommunicationChannel,
    COMMUNICATION_CHANNEL_GET_WEB_CONTENTS_ID,
    composeName,
    type MethodsMap,
} from '@web-auto/electron-ipc';
import { BrowserWindow, ipcMain } from 'electron';

ipcMain.on(COMMUNICATION_CHANNEL_GET_WEB_CONTENTS_ID, (event) => {
    event.returnValue = event.sender.id;
});

export class MainCommuncationChannel<
    L extends MethodsMap,
    R extends MethodsMap,
> extends CommunicationChannel<L, R> {
    private webContentsName: string;

    public constructor(
        name: string,
        private window: BrowserWindow,
    ) {
        super(name);

        this.webContentsName = window.webContents.id.toString();
    }

    private composeName(eventName: string): string {
        return composeName(this.webContentsName, this.name, eventName);
    }

    public send<K extends keyof R & string>(
        eventName: K,
        ...args: Parameters<R[K]>
    ): void {
        const name = this.composeName(eventName);
        this.window.webContents.send(name, ...args);
    }

    public on<K extends keyof L & string>(eventName: K, callback: L[K]): void {
        const name = this.composeName(eventName);
        ipcMain.on(name, (_event, ...args) => {
            callback(...args);
        });
    }

    public handle<K extends keyof L & string>(
        eventName: K,
        callback: L[K],
    ): void {
        const name = this.composeName(eventName);
        ipcMain.handle(name, (_event, ...args) => {
            return callback(...args);
        });
    }
}
