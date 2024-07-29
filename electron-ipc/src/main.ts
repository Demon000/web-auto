import { app, ipcMain, type IpcMainEvent, type WebContents } from 'electron';
import {
    BaseIpcSocket,
    type IpcSerializer,
    type IpcSocketEvents,
} from '@web-auto/common-ipc';
import {
    IpcSocketHandler,
    type IpcSocketHandlerEvents,
} from '@web-auto/common-ipc/main.js';

class ElectronServiceIpcSocket extends BaseIpcSocket {
    private onDataInternalBound: (event: IpcMainEvent, data: any) => void;
    private onCloseInternalBound: () => void;

    public constructor(
        private channelName: string,
        private webContents: WebContents,
        events: IpcSocketEvents,
    ) {
        super(events);

        this.onDataInternalBound = this.onDataInternal.bind(this);
        this.onCloseInternalBound = this.onCloseInternal.bind(this);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async open(): Promise<void> {
        ipcMain.on(this.channelName, this.onDataInternalBound);
        this.webContents.once('destroyed', this.onCloseInternalBound);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async close(): Promise<void> {
        ipcMain.off(this.channelName, this.onDataInternalBound);
        this.webContents.off('destroyed', this.onCloseInternalBound);
    }

    public onDataInternal(event: IpcMainEvent, data: any): void {
        if (event.sender !== this.webContents) {
            return;
        }

        this.callOnData(data);
    }

    public onCloseInternal(): void {
        this.callOnClose();
    }

    public send(data: any): void {
        this.webContents.send(this.channelName, data);
    }
}

export class ElectronIpcServiceRegistrySocketHandler extends IpcSocketHandler {
    private onWebContentsCreatedBound: (
        _event: Electron.Event,
        webContents: WebContents,
    ) => void;

    public constructor(
        serializer: IpcSerializer,
        private name: string,
        events: IpcSocketHandlerEvents,
    ) {
        super(serializer, events);

        this.onWebContentsCreatedBound = this.onWebContentsCreated.bind(this);
    }

    public register(): void {
        app.on('web-contents-created', this.onWebContentsCreatedBound);
    }

    public unregister(): void {
        app.off('web-contents-created', this.onWebContentsCreatedBound);
    }

    public onWebContentsCreated(
        _event: Electron.Event,
        webContents: WebContents,
    ): void {
        this.addSocket((events) => {
            return new ElectronServiceIpcSocket(this.name, webContents, events);
        });
    }
}
