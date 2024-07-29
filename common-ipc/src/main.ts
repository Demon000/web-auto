import assert from 'node:assert';
import type {
    IpcService,
    IpcClient,
    IpcSerializer,
    IpcSocket,
    IpcServiceHandlerKey,
    IpcClientHandlerKey,
    IpcClientEvent,
    IpcServiceEvent,
    IpcRawNotificationEvent,
    IpcNotificationEvent,
    IpcSocketCreateCallback,
} from './common.js';

export type IpcServiceHandlerCallback<
    L extends IpcService,
    K extends IpcServiceHandlerKey<L>,
> = L[K];

export type IpcServiceHandler<L extends IpcService, R extends IpcClient> = R &
    Pick<
        IpcServiceHandlerHelper<L, R>,
        'on' | 'off' | 'onNoClients' | 'offNoClients' | 'send' | 'sendRaw'
    > & {
        helper: IpcServiceHandlerHelper<L, R>;
    };

type SocketMessageCallback = (socket: IpcSocket, data: any) => void;
type SocketCloseCallback = (socket: IpcSocket) => void;
type SendIpcNotificationEvent = (
    ipcEvent: IpcNotificationEvent | IpcRawNotificationEvent,
    raw?: Uint8Array,
) => void;

export type IpcSocketHandlerEvents = {
    onSocketData: SocketMessageCallback;
    onSocketClose: SocketCloseCallback;
};

export abstract class IpcSocketHandler {
    public constructor(
        public serializer: IpcSerializer,
        protected events: IpcSocketHandlerEvents,
    ) {}

    public abstract register(): void;
    public abstract unregister(): void;

    public addSocket(cb: IpcSocketCreateCallback): void {
        const socket = cb({
            onSocketData: this.events.onSocketData,
            onSocketClose: this.events.onSocketClose,
        });

        socket
            .open()
            .then(() => {})
            .catch((err) => {
                console.error('Failed to register socket', socket, err);
            });
    }
}

export class IpcServiceHandlerHelper<
    L extends IpcService,
    R extends IpcClient,
> {
    private handlersMap = new Map<
        IpcServiceHandlerKey<L>,
        IpcServiceHandlerCallback<L, IpcServiceHandlerKey<L>>
    >();

    private noClientsHandlersMap = new Map<
        IpcServiceHandlerKey<L>,
        () => void
    >();

    public constructor(
        private handle: string,
        private sendIpcNotificationEvent: SendIpcNotificationEvent,
    ) {}

    public sendRaw<
        K extends IpcClientHandlerKey<R>,
        F extends R[K],
        P extends Parameters<F> & [Uint8Array, ...any],
    >(name: K, ...allArgs: P): void {
        const raw = allArgs[0];
        const args = allArgs.slice(1);
        const ipcEvent: IpcRawNotificationEvent = {
            handle: this.handle,
            name,
            raw: true,
        };

        if (args.length) {
            ipcEvent.args = args;
        }

        this.sendIpcNotificationEvent(ipcEvent, raw);
    }

    public send<
        K extends IpcClientHandlerKey<R>,
        F extends R[K],
        P extends Parameters<F>,
    >(name: K, ...args: P): void {
        const ipcEvent: IpcNotificationEvent = {
            handle: this.handle,
            name,
            args,
        };

        this.sendIpcNotificationEvent(ipcEvent);
    }

    public on<K extends IpcServiceHandlerKey<L>>(
        name: K,
        cb: IpcServiceHandlerCallback<L, K>,
    ): void {
        assert(!this.handlersMap.has(name));
        this.handlersMap.set(name, cb);
    }

    public onNoClients<K extends IpcClientHandlerKey<R>>(
        name: K,
        cb: () => void,
    ): void {
        assert(!this.noClientsHandlersMap.has(name));
        this.noClientsHandlersMap.set(name, cb);
    }

    public offNoClients<K extends IpcClientHandlerKey<R>>(name: K): void {
        assert(this.noClientsHandlersMap.has(name));
        this.noClientsHandlersMap.delete(name);
    }

    public off<K extends IpcServiceHandlerKey<L>>(name: K): void {
        assert(this.handlersMap.has(name));
        this.handlersMap.delete(name);
    }

    public handleMessage(ipcEvent: IpcServiceEvent): Promise<any> {
        assert('name' in ipcEvent);
        assert('args' in ipcEvent);

        const handlerFn = this.handlersMap.get(ipcEvent.name);
        if (handlerFn === undefined) {
            throw new Error(`Failed to find handler ${ipcEvent.name}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return handlerFn(...ipcEvent.args);
    }

    public handleNoClients(name: string): void {
        const handlerFn = this.noClientsHandlersMap.get(name);
        if (handlerFn === undefined) {
            return;
        }

        handlerFn();
    }
}

export const createIpcClientProxy = <L extends IpcService, R extends IpcClient>(
    ipcHandler: IpcServiceHandlerHelper<L, R>,
): IpcServiceHandler<L, R> => {
    return new Proxy(
        {},
        {
            get(_target, property) {
                if (typeof property === 'symbol') {
                    throw new Error(
                        `Cannot send symbol ${String(property)} via IPC`,
                    );
                }

                if (property === 'helper') {
                    return ipcHandler;
                }

                return new Proxy(() => {}, {
                    apply(_target, _thisArg, args) {
                        switch (property) {
                            case 'on':
                            case 'off':
                            case 'onNoClients':
                            case 'offNoClients':
                            case 'send':
                            case 'sendRaw':
                                Reflect.apply(
                                    ipcHandler[property],
                                    ipcHandler,
                                    args,
                                );
                                return;
                        }

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        return ipcHandler.send(property, ...(args as any));
                    },
                });
            },
        },
    ) as IpcServiceHandler<L, R>;
};

export type IpcSocketHandlersCreateCallback = (
    events: IpcSocketHandlerEvents,
) => IpcSocketHandler[];

export class IpcServiceRegistry {
    protected ipcHandlers = new Map<
        string,
        IpcServiceHandlerHelper<any, any>
    >();

    protected handleNameSocketsMap = new Map<
        string,
        Map<string, Map<IpcSocket, number>>
    >();

    protected socketHandlers: IpcSocketHandler[];

    public constructor(cb: IpcSocketHandlersCreateCallback) {
        this.socketHandlers = cb({
            onSocketData: this.onSocketData.bind(this),
            onSocketClose: this.onSocketClose.bind(this),
        });
    }

    public register(): void {
        for (const socketHandler of this.socketHandlers) {
            socketHandler.register();
        }
    }

    public unregister(): void {
        for (const socketHandler of this.socketHandlers) {
            socketHandler.unregister();
        }
    }

    private socketsForHandleName(
        handle: string,
        name: string,
    ): Iterable<IpcSocket> | undefined {
        const handleMap = this.handleNameSocketsMap.get(handle);
        if (handleMap === undefined) {
            return undefined;
        }

        const sockets = handleMap.get(name);
        if (sockets === undefined) {
            return undefined;
        }

        return sockets.keys();
    }

    private onSocketClose(socket: IpcSocket): void {
        for (const [handle, handleMap] of this.handleNameSocketsMap) {
            for (const name of handleMap.keys()) {
                this.handleSocketSubscribe(socket, handle, name, undefined);
            }
        }
    }

    public handleSocketSubscribe(
        socket: IpcSocket,
        handle: string,
        name: string,
        subscribe: boolean | undefined,
    ): void {
        let handleMap = this.handleNameSocketsMap.get(handle);
        if (handleMap === undefined) {
            handleMap = new Map();
            this.handleNameSocketsMap.set(handle, handleMap);
        }

        let socketsMap = handleMap.get(name);
        if (socketsMap === undefined) {
            socketsMap = new Map();
            handleMap.set(name, socketsMap);
        }

        let value;
        if (subscribe === undefined) {
            value = 0;
        } else {
            const modifier = subscribe ? +1 : -1;
            value = socketsMap.get(socket);
            if (value === undefined) {
                value = 0;
            }

            value += modifier;
        }

        if (value < 0) {
            console.error('Socket subscribe count < 0', handle, name, socket);
            return;
        }

        if (value === 0) {
            socketsMap.delete(socket);
        } else {
            socketsMap.set(socket, value);
        }

        if (socketsMap.size === 0) {
            this.handleNoClients(handle, name);
        }
    }
    private handleNoClients(handle: string, name: string): void {
        const ipcHandler = this.ipcHandlers.get(handle);
        if (ipcHandler === undefined) {
            return;
        }

        ipcHandler.handleNoClients(name);
    }

    private onSocketData(socket: IpcSocket, data: any): void {
        this.handleMessageAsync(socket, data)
            .then(() => {})
            .catch((err) => {
                console.error(err);
            });
    }

    private sendIpcNotificationEvent(
        ipcEvent: IpcNotificationEvent | IpcRawNotificationEvent,
        raw?: Uint8Array,
    ) {
        const sockets = this.socketsForHandleName(
            ipcEvent.handle,
            ipcEvent.name,
        );

        if (sockets === undefined) {
            return;
        }

        const socketSerializerDataMap = new Map<IpcSerializer, any>();

        for (const socket of sockets) {
            const serializer = socket.serializer;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            let data = socketSerializerDataMap.get(serializer);
            if (data === undefined) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                data = serializer.serialize(ipcEvent);
                socketSerializerDataMap.set(serializer, data);
            }

            socket.send(data);

            if (raw !== undefined) {
                socket.send(raw);
            }
        }
    }

    private async handleMessageAsync(
        socket: IpcSocket,
        data: any,
    ): Promise<void> {
        const ipcEvent = socket.serializer.deserialize(data);

        if ('subscribe' in ipcEvent) {
            this.handleSocketSubscribe(
                socket,
                ipcEvent.handle,
                ipcEvent.name,
                ipcEvent.subscribe,
            );
            return;
        }

        assert('handle' in ipcEvent);
        assert('id' in ipcEvent);

        const ipcHandler = this.ipcHandlers.get(ipcEvent.handle);

        let replyIpcEvent: IpcClientEvent;

        if (ipcHandler === undefined) {
            replyIpcEvent = {
                replyToId: ipcEvent.id,
                handle: ipcEvent.handle,
                err: `Unhandled IPC event for handler ${ipcEvent.handle}`,
            };
        } else {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const result = await ipcHandler.handleMessage(ipcEvent);
                replyIpcEvent = {
                    replyToId: ipcEvent.id,
                    handle: ipcEvent.handle,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const replyData = socket.serializer.serialize(replyIpcEvent);

        socket.send(replyData);
    }

    public registerIpcService<L extends IpcService, R extends IpcClient>(
        handle: string,
    ): IpcServiceHandler<L, R> {
        assert(!this.ipcHandlers.has(handle));
        const ipcHandler = new IpcServiceHandlerHelper<L, R>(
            handle,
            this.sendIpcNotificationEvent.bind(this),
        );
        this.ipcHandlers.set(handle, ipcHandler);

        return createIpcClientProxy(ipcHandler);
    }

    public unregisterIpcService(handle: string): void {
        assert(this.ipcHandlers.has(handle));
        this.ipcHandlers.delete(handle);
    }
}
