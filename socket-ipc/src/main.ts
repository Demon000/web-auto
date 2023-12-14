import {
    type IpcEvent,
    type IpcClient,
    type IpcService,
    type IpcServiceHandler,
    type IpcServiceRegistry,
} from '@web-auto/common-ipc';
import { BSON } from 'bson';
import assert from 'node:assert';
import { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { BsonDeserializeOptions } from './common.js';

class SocketIpcServiceHandlerHelper<L extends IpcService> {
    private map: Partial<L> = {};

    public constructor(
        private server: WebSocketServer,
        private handle: string,
    ) {}

    public send(name: string, ...args: any[]): void {
        const ipcEvent: IpcEvent = {
            handle: this.handle,
            name,
            args,
        };

        const data = BSON.serialize(ipcEvent);

        for (const client of this.server.clients) {
            client.send(data);
        }
    }

    public on<K extends keyof L, F extends L[K]>(
        name: K,
        cb: (...args: Parameters<F>) => ReturnType<F>,
    ): void {
        assert(!(name in this.map));
        this.map[name] = cb as any;
    }

    public off<K extends keyof L>(name: K): void {
        assert(name in this.map);
        delete this.map[name];
    }

    public async handleMessage(ipcEvent: IpcEvent): Promise<any> {
        assert('name' in ipcEvent);

        const handlerFn = this.map[ipcEvent.name];
        assert(handlerFn !== undefined);

        return handlerFn(...(ipcEvent.args as any));
    }
}

function createIpcClientProxy<L extends IpcService, R extends IpcClient>(
    ipcHandler: SocketIpcServiceHandlerHelper<L>,
): IpcServiceHandler<L, R> {
    return new Proxy(
        {},
        {
            get(_target, property) {
                if (typeof property === 'symbol') {
                    throw new Error(
                        `Cannot send symbol ${String(property)} via IPC`,
                    );
                }

                return new Proxy(() => {}, {
                    apply(_target, _thisArg, args) {
                        switch (property) {
                            case 'on':
                            case 'off':
                                return Reflect.apply(
                                    ipcHandler[property],
                                    ipcHandler,
                                    args,
                                );
                        }

                        return ipcHandler.send(property, ...args);
                    },
                });
            },
        },
    ) as IpcServiceHandler<L, R>;
}

export class SocketIpcServiceRegistry implements IpcServiceRegistry {
    private ipcHandlers = new Map<string, SocketIpcServiceHandlerHelper<any>>();
    private wss: WebSocketServer;

    public constructor(
        private name: string,
        private server: Server,
    ) {
        this.onServerUpgrade = this.onServerUpgrade.bind(this);
        this.onConnection = this.onConnection.bind(this);

        this.wss = new WebSocketServer({ noServer: true });
    }

    public register() {
        this.wss.on('connection', this.onConnection);
        this.server.prependListener('upgrade', this.onServerUpgrade);
    }

    public unregister() {
        this.server.removeListener('upgrade', this.onServerUpgrade);
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

    private onConnection(socket: WebSocket): void {
        const handleMessage = this.handleMessage.bind(this, socket);

        socket.on('message', handleMessage);
        socket.once('close', () => {
            socket.off('message', handleMessage);
        });
    }

    private async handleMessage(
        socket: WebSocket,
        data: Buffer,
        isBinary: boolean,
    ): Promise<void> {
        assert(isBinary);

        const ipcEvent = BSON.deserialize(
            data,
            BsonDeserializeOptions,
        ) as IpcEvent;

        assert('handle' in ipcEvent);
        assert('id' in ipcEvent);

        for (const [name, ipcHandler] of this.ipcHandlers) {
            if (ipcEvent.handle !== name) {
                continue;
            }

            let replyIpcEvent: IpcEvent;
            try {
                const result = await ipcHandler.handleMessage(ipcEvent);
                replyIpcEvent = {
                    replyToId: ipcEvent.id,
                    handle: ipcEvent.handle,
                    result,
                };
            } catch (err) {
                assert(err instanceof Error);
                replyIpcEvent = {
                    replyToId: ipcEvent.id,
                    handle: ipcEvent.handle,
                    err: err.message,
                };
            }

            const data = BSON.serialize(replyIpcEvent);
            socket.send(data);

            return;
        }

        throw new Error(`Unhandled IPC event for handler ${ipcEvent.handle}`);
    }

    public registerIpcService<L extends IpcService, R extends IpcClient>(
        handle: string,
    ): IpcServiceHandler<L, R> {
        assert(this.server !== undefined);
        assert(!this.ipcHandlers.has(handle));
        const ipcHandler = new SocketIpcServiceHandlerHelper<L>(
            this.wss,
            handle,
        );
        this.ipcHandlers.set(handle, ipcHandler);

        return createIpcClientProxy(ipcHandler);
    }

    public unregisterIpcService(handle: string): void {
        assert(this.ipcHandlers.has(handle));
        this.ipcHandlers.delete(handle);
    }
}
