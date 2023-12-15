import {
    IpcMessenger,
    type IpcSocket,
    type IpcSocketDataCallback,
} from '@web-auto/common-ipc';
import { GenericIpcClientRegistry } from '@web-auto/common-ipc/renderer.js';

import { BsonIpcSerializer } from './common.js';

class SocketClientIpcSocket implements IpcSocket {
    private socket?: WebSocket;
    private dataCallback?: IpcSocketDataCallback;

    public constructor(private url: string) {
        this.onDataInternal = this.onDataInternal.bind(this);
    }

    public async open(): Promise<void> {
        const socket = new WebSocket(this.url);

        socket.binaryType = 'arraybuffer';

        return new Promise((resolve, reject) => {
            const cleanup = () => {
                socket.removeEventListener('open', onOpen);
                socket.removeEventListener('error', onError);
                socket.removeEventListener('message', this.onDataInternal);
            };

            const onOpen = () => {
                cleanup();
                resolve();
            };

            const onError = () => {
                cleanup();
                reject();
            };

            socket.addEventListener('open', onOpen);
            socket.addEventListener('error', onError);
            socket.addEventListener('message', this.onDataInternal);
        });
    }

    public onDataInternal(message: MessageEvent): void {
        if (this.dataCallback === undefined) {
            console.error('Received data without callback', message.data);
            return;
        }

        this.dataCallback(message.data);
    }

    public async close(): Promise<void> {
        if (this.socket === undefined) {
            throw new Error('Cannot call close before calling open');
        }

        const socket = this.socket;

        socket.removeEventListener('message', this.onDataInternal);

        return new Promise((resolve) => {
            const onClose = () => {
                socket.removeEventListener('close', onClose);
                resolve();
            };

            socket.addEventListener('close', onClose);

            socket.close();
        });
    }

    public send(data: any): void {
        if (this.socket === undefined) {
            throw new Error('Cannot call send before calling open');
        }

        this.socket.send(data);
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
    public constructor(host: string, port: number, name: string) {
        const socket = new SocketClientIpcSocket(
            `ws://${host}:${port}/${name}`,
        );
        const serializer = new BsonIpcSerializer();
        const messenger = new IpcMessenger(serializer, socket);
        super(messenger);
    }
}
