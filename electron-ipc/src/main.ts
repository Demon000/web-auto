import { app, ipcMain, type IpcMainEvent, type WebContents } from 'electron';
import { DummyIpcSerializer, BaseIpcSocket } from '@web-auto/common-ipc';
import {
    BaseIpcServiceRegistrySocketHandler,
    GenericIpcServiceRegistry,
    type SocketMessageCallback,
} from '@web-auto/common-ipc/main.js';

class ElectronServiceIpcSocket extends BaseIpcSocket {
    public constructor(
        private channelName: string,
        private webContents: WebContents,
    ) {
        super();

        this.onDataInternal = this.onDataInternal.bind(this);
        this.onCloseInternal = this.onCloseInternal.bind(this);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async open(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ipcMain.on(this.channelName, this.onDataInternal);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.webContents.once('destroyed', this.onCloseInternal);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async close(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ipcMain.off(this.channelName, this.onDataInternal);
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
    public constructor(name: string) {
        super(name);

        this.onWebContentsCreated = this.onWebContentsCreated.bind(this);
    }

    public register(callback: SocketMessageCallback): void {
        super.register(callback);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        app.on('web-contents-created', this.onWebContentsCreated);
    }

    public unregister(): void {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        app.off('web-contents-created', this.onWebContentsCreated);
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
    protected socketHandler: ElectronIpcServiceRegistrySocketHandler;

    public constructor(name: string) {
        const socketHandler = new ElectronIpcServiceRegistrySocketHandler(name);
        const serializer = new DummyIpcSerializer();
        super(socketHandler, serializer);
        this.socketHandler = socketHandler;
    }
}
