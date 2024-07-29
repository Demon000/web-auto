import {
    BaseIpcSocket,
    type IpcSerializer,
    type IpcSocketEvents,
} from '@web-auto/common-ipc';
import { IpcSocketHandler } from '@web-auto/common-ipc/main.js';
import { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import {
    WebSocket,
    WebSocketServer,
    type MessageEvent,
    type CloseEvent,
} from 'ws';

class SocketServiceIpcSocket extends BaseIpcSocket {
    private onDataInternalBound: (event: MessageEvent) => void;
    private onCloseInternalBound: (_event: CloseEvent) => void;

    public constructor(
        private socket: WebSocket,
        serializer: IpcSerializer,
        events: IpcSocketEvents,
    ) {
        super(serializer, events);

        this.onDataInternalBound = this.onDataInternal.bind(this);
        this.onCloseInternalBound = this.onCloseInternal.bind(this);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async open(): Promise<void> {
        this.socket.addEventListener('message', this.onDataInternalBound);
        this.socket.addEventListener('close', this.onCloseInternalBound);
    }

    public async close(): Promise<void> {
        this.socket.removeEventListener('message', this.onDataInternalBound);
        this.socket.removeEventListener('close', this.onCloseInternalBound);

        return new Promise((resolve) => {
            const onClose = () => {
                this.socket.removeEventListener('close', onClose);
                resolve();
            };

            this.socket.addEventListener('close', onClose);

            this.socket.close();
        });
    }

    public onDataInternal(event: MessageEvent): void {
        this.callOnData(event.data);
    }

    public onCloseInternal(_event: CloseEvent): void {
        this.socket.removeEventListener('message', this.onDataInternalBound);
        this.socket.removeEventListener('close', this.onCloseInternalBound);
        this.callOnClose();
    }

    public send(data: any): void {
        if (this.socket === undefined) {
            throw new Error('Cannot call send before calling open');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.socket.send(data, {
            binary: true,
            compress: false,
        });
    }
}

export class SocketIpcServiceRegistrySocketHandler extends IpcSocketHandler {
    private wss: WebSocketServer;
    private onServerUpgradeBound: (
        req: InstanceType<typeof IncomingMessage>,
        socket: Duplex,
        head: Buffer,
    ) => void;
    private onConnectionBound: (webSocket: WebSocket) => void;

    public constructor(
        serializer: IpcSerializer,
        private name: string,
        private server: Server,
        events: IpcSocketEvents,
    ) {
        super(serializer, events);

        this.onServerUpgradeBound = this.onServerUpgrade.bind(this);
        this.onConnectionBound = this.onConnection.bind(this);

        this.wss = new WebSocketServer({ noServer: true });
    }

    public register() {
        this.wss.on('connection', this.onConnectionBound);
        this.server.prependListener('upgrade', this.onServerUpgradeBound);
    }

    public unregister() {
        this.server.removeListener('upgrade', this.onServerUpgradeBound);
        this.wss.off('connection', this.onConnectionBound);
    }

    private onServerUpgrade(
        req: InstanceType<typeof IncomingMessage>,
        socket: Duplex,
        head: Buffer,
    ) {
        if (req.url === `/${this.name}`) {
            this.wss.handleUpgrade(req, socket, head, (ws) => {
                this.wss.emit('connection', ws, req);
            });
        }
    }

    private onConnection(webSocket: WebSocket): void {
        this.addSocket((events) => {
            return new SocketServiceIpcSocket(
                webSocket,
                this.serializer,
                events,
            );
        });
    }
}
