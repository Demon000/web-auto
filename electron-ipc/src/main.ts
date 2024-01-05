import { app, ipcMain, type IpcMainEvent, type WebContents } from 'electron';
import { DummyIpcSerializer, BaseIpcSocket } from '@web-auto/common-ipc';
import {
    BaseIpcServiceRegistrySocketHandler,
    GenericIpcServiceRegistry,
    type SocketMessageCallback,
} from '@web-auto/common-ipc/main.js';

class ElectronServiceIpcSocket extends BaseIpcSocket {
    private onDataInternalBound: (event: IpcMainEvent, data: any) => void;
    private onCloseInternalBound: () => void;

    public constructor(
        private channelName: string,
        private webContents: WebContents,
    ) {
        super();

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

export class ElectronIpcServiceRegistrySocketHandler extends BaseIpcServiceRegistrySocketHandler {
    private onWebContentsCreatedBound: (
        _event: Electron.Event,
        webContents: WebContents,
    ) => void;

    public constructor(name: string) {
        super(name);

        this.onWebContentsCreatedBound = this.onWebContentsCreated.bind(this);
    }

    public override register(callback: SocketMessageCallback): void {
        super.register(callback);

        app.on('web-contents-created', this.onWebContentsCreatedBound);
    }

    public override unregister(): void {
        app.off('web-contents-created', this.onWebContentsCreatedBound);
    }

    public onWebContentsCreated(
        _event: Electron.Event,
        webContents: WebContents,
    ): void {
        const socket = new ElectronServiceIpcSocket(this.name, webContents);

        this.addSocket(socket);
    }
}

export class ElectronIpcServiceRegistry extends GenericIpcServiceRegistry {
    protected override socketHandler: ElectronIpcServiceRegistrySocketHandler;

    public constructor(name: string) {
        const socketHandler = new ElectronIpcServiceRegistrySocketHandler(name);
        const serializer = new DummyIpcSerializer();
        super(socketHandler, serializer);
        this.socketHandler = socketHandler;
    }
}
