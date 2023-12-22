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
import { BsonIpcSerializer } from './common.js';

class SocketServiceIpcSocket extends BaseIpcSocket {
    public constructor(private socket: WebSocket) {
        super();

        this.onDataInternal = this.onDataInternal.bind(this);
        this.onCloseInternal = this.onCloseInternal.bind(this);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async open(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.addEventListener('message', this.onDataInternal);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.addEventListener('close', this.onCloseInternal);
    }

    public async close(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.removeEventListener('message', this.onDataInternal);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.removeEventListener('close', this.onCloseInternal);

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
        this.socket.send(data);
    }
}

export class SocketIpcServiceRegistrySocketHandler extends BaseIpcServiceRegistrySocketHandler {
    private wss: WebSocketServer;

    public constructor(
        name: string,
        private server: Server,
    ) {
        super(name);

        this.onServerUpgrade = this.onServerUpgrade.bind(this);
        this.onConnection = this.onConnection.bind(this);

        this.wss = new WebSocketServer({ noServer: true });
    }

    public register(callback: SocketMessageCallback) {
        super.register(callback);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.wss.on('connection', this.onConnection);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.server.prependListener('upgrade', this.onServerUpgrade);
    }

    public unregister() {
        super.unregister();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.server.removeListener('upgrade', this.onServerUpgrade);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.wss.off('connection', this.onConnection);
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
        const serializer = new BsonIpcSerializer();
        super(socketHandler, serializer);
    }
}
