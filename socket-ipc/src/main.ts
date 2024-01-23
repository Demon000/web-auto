import { BaseIpcSocket } from '@web-auto/common-ipc';
import {
    BaseIpcServiceRegistrySocketHandler,
    GenericIpcServiceRegistry,
    type SocketMessageCallback,
} from '@web-auto/common-ipc/main.js';
import { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import {
    WebSocket,
    WebSocketServer,
    type MessageEvent,
    type CloseEvent,
} from 'ws';
import { MessagePackIpcSerializer } from './common.js';

class SocketServiceIpcSocket extends BaseIpcSocket {
    private onDataInternalBound: (event: MessageEvent) => void;
    private onCloseInternalBound: (_event: CloseEvent) => void;

    public constructor(private socket: WebSocket) {
        super();

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

export class SocketIpcServiceRegistrySocketHandler extends BaseIpcServiceRegistrySocketHandler {
    private wss: WebSocketServer;
    private onServerUpgradeBound: (
        req: InstanceType<typeof IncomingMessage>,
        socket: Duplex,
        head: Buffer,
    ) => void;
    private onConnectionBound: (webSocket: WebSocket) => void;

    public constructor(
        name: string,
        private server: Server,
    ) {
        super(name);

        this.onServerUpgradeBound = this.onServerUpgrade.bind(this);
        this.onConnectionBound = this.onConnection.bind(this);

        this.wss = new WebSocketServer({ noServer: true });
    }

    public override register(callback: SocketMessageCallback) {
        super.register(callback);

        this.wss.on('connection', this.onConnectionBound);
        this.server.prependListener('upgrade', this.onServerUpgradeBound);
    }

    public override unregister() {
        super.unregister();

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
        const socket = new SocketServiceIpcSocket(webSocket);
        this.addSocket(socket);
    }
}

export class SocketIpcServiceRegistry extends GenericIpcServiceRegistry {
    public constructor(name: string, server: Server) {
        const socketHandler = new SocketIpcServiceRegistrySocketHandler(
            name,
            server,
        );
        const serializer = new MessagePackIpcSerializer();
        super(socketHandler, serializer);
    }
}
