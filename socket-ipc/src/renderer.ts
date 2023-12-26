import { GenericIpcClientRegistry } from '@web-auto/common-ipc/renderer.js';

import { MessagePackIpcSerializer } from './common.js';
import { BaseIpcSocket } from '@web-auto/common-ipc';

class SocketClientIpcSocket extends BaseIpcSocket {
    private socket?: WebSocket;

    public constructor(private url: string) {
        super();

        this.onDataInternal = this.onDataInternal.bind(this);
        this.onCloseInternal = this.onCloseInternal.bind(this);
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
                // eslint-disable-next-line @typescript-eslint/unbound-method
                socket.addEventListener('close', this.onCloseInternal);
                // eslint-disable-next-line @typescript-eslint/unbound-method
                socket.addEventListener('message', this.onDataInternal);
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
        this.callOnData(message.data);
    }

    public onCloseInternal(): void {
        this.callOnClose();
    }

    public async close(): Promise<void> {
        if (this.socket === undefined) {
            throw new Error('Cannot call close before calling open');
        }

        const socket = this.socket;

        // eslint-disable-next-line @typescript-eslint/unbound-method
        socket.removeEventListener('close', this.onCloseInternal);
        // eslint-disable-next-line @typescript-eslint/unbound-method
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.socket.send(data);
    }
}

export class SocketIpcClientRegistry extends GenericIpcClientRegistry {
    public constructor(host: string, port: number, name: string) {
        const socket = new SocketClientIpcSocket(
            `ws://${host}:${port}/${name}`,
        );
        const serializer = new MessagePackIpcSerializer();
        super(serializer, socket);
    }
}
