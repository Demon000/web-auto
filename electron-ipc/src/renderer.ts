import type { IpcRendererEvent } from 'electron';
import {
    ELECTRON_IPC_COMMUNICATION_CHANNEL,
    type IpcPreloadExposed,
} from './common.js';
import {
    IpcMessenger,
    type IpcSocket,
    type IpcSocketDataCallback,
    DummyIpcSerializer,
} from '@web-auto/common-ipc';

import { GenericIpcClientRegistry } from '@web-auto/common-ipc/renderer.js';

declare const window: {
    [ELECTRON_IPC_COMMUNICATION_CHANNEL]?: IpcPreloadExposed;
};

const exposed = window[ELECTRON_IPC_COMMUNICATION_CHANNEL];

class ElectronIpcSocket implements IpcSocket {
    private dataCallback?: IpcSocketDataCallback;

    public constructor(private name: string) {
        this.onDataInternal = this.onDataInternal.bind(this);
    }

    public async open(): Promise<void> {
        if (exposed === undefined) {
            throw new Error('IPC communication not exposed');
        }

        exposed.on(this.name, this.onDataInternal);
    }

    public onDataInternal(_event: IpcRendererEvent, data: any): void {
        if (this.dataCallback === undefined) {
            console.error('Received data without callback', data);
            return;
        }

        this.dataCallback(data);
    }

    public async close(): Promise<void> {
        if (exposed === undefined) {
            throw new Error('IPC communication not exposed');
        }

        exposed.off(this.name, this.onDataInternal);
    }

    public send(data: any): void {
        if (exposed === undefined) {
            throw new Error('IPC communication not exposed');
        }

        exposed.send(this.name, data);
    }

    public onData(callback: IpcSocketDataCallback): void {
        if (this.dataCallback !== undefined) {
            throw new Error('Cannot attach data callback twice');
        }

        this.dataCallback = callback;
    }

    public offData(): void {
        if (this.dataCallback === undefined) {
            throw new Error('Cannot detach data callback twice');
        }

        this.dataCallback = undefined;
    }
}

export class SocketIpcClientRegistry extends GenericIpcClientRegistry {
    public constructor(name: string) {
        const socket = new ElectronIpcSocket(name);
        const serializer = new DummyIpcSerializer();
        const messenger = new IpcMessenger(serializer, socket);
        super(messenger);
    }
}
