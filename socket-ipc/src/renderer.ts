import { GenericIpcClientRegistry } from '@web-auto/common-ipc/renderer.js';

import { MessagePackIpcSerializer } from './common.js';
import { BaseIpcSocket } from '@web-auto/common-ipc';

class SocketClientIpcSocket extends BaseIpcSocket {
    private socket?: WebSocket;
    private onDataInternalBound: (message: MessageEvent) => void;
    private onCloseInternalBound: () => void;

    public constructor(private url: string) {
        super();

        this.onDataInternalBound = this.onDataInternal.bind(this);
        this.onCloseInternalBound = this.onCloseInternal.bind(this);
    }

    public async open(): Promise<void> {
        const socket = new WebSocket(this.url);

        socket.binaryType = 'arraybuffer';

        return new Promise((resolve, reject) => {
            const cleanup = () => {
                socket.removeEventListener('open', onOpen);
                socket.removeEventListener('error', onError);
            };

            const onOpen = () => {
                this.socket = socket;
                socket.addEventListener('close', this.onCloseInternalBound);
                socket.addEventListener('message', this.onDataInternalBound);
                cleanup();
                resolve();
            };

            const onError = () => {
                cleanup();
                reject();
            };

            socket.addEventListener('open', onOpen);
            socket.addEventListener('error', onError);
        });
    }

    public onDataInternal(message: MessageEvent): void {
        const buffer = new Uint8Array(message.data as ArrayBuffer);
        this.callOnData(buffer);
    }

    public onCloseInternal(): void {
        this.callOnClose();
    }

    public async close(): Promise<void> {
        if (this.socket === undefined) {
            throw new Error('Cannot call close before calling open');
        }

        const socket = this.socket;

        socket.removeEventListener('close', this.onCloseInternalBound);
        socket.removeEventListener('message', this.onDataInternalBound);

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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.socket.send(data);
    }
}

export class SocketIpcClientRegistry extends GenericIpcClientRegistry {
    public constructor(host: string, port: number, name: string) {
        const socket = new SocketClientIpcSocket(
            `wss://${host}:${port}/${name}`,
        );
        const serializer = new MessagePackIpcSerializer();
        super(serializer, socket);
    }
}
