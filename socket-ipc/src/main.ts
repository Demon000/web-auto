import { BaseIpcSocket } from '@web-auto/common-ipc';
import {
    BaseIpcServiceRegistrySocketHandler,
    GenericIpcServiceRegistry,
    type SocketMessageCallback,
} from '@web-auto/common-ipc/main.js';
import { MessagePackIpcSerializer } from './common.js';
import { type TemplatedApp, type WebSocket } from 'uWebSockets.js';
import assert from 'node:assert';

type UserData = Record<string, never>;

class SocketServiceIpcSocket extends BaseIpcSocket {
    public constructor(private socket: WebSocket<UserData>) {
        super();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async open(): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/require-await
    public async close(): Promise<void> {
        this.socket.close();
    }

    public send(data: any): void {
        if (this.socket === undefined) {
            throw new Error('Cannot call send before calling open');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.socket.send(data, true);
    }
}

export class SocketIpcServiceRegistrySocketHandler extends BaseIpcServiceRegistrySocketHandler {
    private socketMap = new Map<WebSocket<UserData>, SocketServiceIpcSocket>();
    private onConnectionOpenBound: (webSocket: WebSocket<UserData>) => void;
    private onConnectionCloseBound: (webSocket: WebSocket<UserData>) => void;
    private onMessageBound: (
        webSocket: WebSocket<UserData>,
        message: ArrayBuffer,
    ) => void;

    public constructor(name: string, server: TemplatedApp) {
        super(name);

        this.onConnectionOpenBound = this.onConnectionOpen.bind(this);
        this.onConnectionCloseBound = this.onConnectionClose.bind(this);
        this.onMessageBound = this.onMessage.bind(this);

        server.ws(`/${name}`, {
            open: this.onConnectionOpenBound,
            message: this.onMessageBound,
            close: this.onConnectionCloseBound,
        });
    }

    public override register(callback: SocketMessageCallback) {
        super.register(callback);
    }

    public override unregister() {
        super.unregister();
    }

    private onConnectionOpen(webSocket: WebSocket<UserData>): void {
        const socket = new SocketServiceIpcSocket(webSocket);
        this.socketMap.set(webSocket, socket);
        this.addSocket(socket);
    }

    private onMessage(
        webSocket: WebSocket<UserData>,
        buffer: ArrayBuffer,
    ): void {
        const socket = this.socketMap.get(webSocket);
        assert(socket !== undefined);
        socket.callOnData(new Uint8Array(buffer));
    }

    private onConnectionClose(webSocket: WebSocket<UserData>): void {
        const socket = this.socketMap.get(webSocket);
        assert(socket !== undefined);
        socket.callOnClose();
    }
}

export class SocketIpcServiceRegistry extends GenericIpcServiceRegistry {
    public constructor(name: string, server: TemplatedApp) {
        const socketHandler = new SocketIpcServiceRegistrySocketHandler(
            name,
            server,
        );
        const serializer = new MessagePackIpcSerializer();
        super(socketHandler, serializer);
    }
}
