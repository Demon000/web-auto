import assert from 'node:assert';
import type {
    IpcService,
    IpcClient,
    IpcEvent,
    IpcSerializer,
    IpcSocket,
    IpcSubscribeEvent,
    IpcServiceHandlerKey,
    IpcClientHandlerKey,
} from './common.js';

export type IpcServiceHandlerCallback<
    L extends IpcService,
    K extends IpcServiceHandlerKey<L>,
> = L[K];

export type IpcServiceHandlerEmitter<
    L extends IpcService,
    R extends IpcClient,
> = {
    on<K extends IpcServiceHandlerKey<L>>(
        name: K,
        cb: IpcServiceHandlerCallback<L, K>,
    ): void;
    off<K extends IpcServiceHandlerKey<L>>(name: K): void;
    onNoClients<K extends IpcClientHandlerKey<R>>(
        name: K,
        cb: () => void,
    ): void;
    offNoClients<K extends IpcClientHandlerKey<R>>(name: K): void;
};

export type IpcServiceHandlerSender<R extends IpcClient> = {
    sendRaw<
        K extends IpcClientHandlerKey<R>,
        F extends R[K],
        P extends Parameters<F> & [Uint8Array, ...any],
    >(
        name: K,
        ...args: P
    ): void;
};

export type IpcServiceHandler<L extends IpcService, R extends IpcClient> = R &
    IpcServiceHandlerEmitter<L, R> &
    IpcServiceHandlerSender<R>;

export interface IpcServiceRegistry {
    registerIpcService<L extends IpcService, R extends IpcClient>(
        handle: string,
    ): IpcServiceHandler<L, R>;
}

export type SocketMessageCallback = (socket: IpcSocket, data: any) => void;
export type NoClientsCallback = (handle: string, name: string) => void;

export interface IpcServiceRegistrySocketHandler {
    socketsForHandleName(
        handle: string,
        name: string,
    ): Iterable<IpcSocket> | undefined;
    register(
        callback: SocketMessageCallback,
        noClientsCallback: NoClientsCallback,
    ): void;
    unregister(): void;
}

export abstract class BaseIpcServiceRegistrySocketHandler
    implements IpcServiceRegistrySocketHandler
{
    protected messageCallback: SocketMessageCallback | undefined;
    protected noClientsCallback: NoClientsCallback | undefined;
    protected handleNameSocketsMap = new Map<
        string,
        Map<string, Map<IpcSocket, number>>
    >();

    public constructor(protected name: string) {}

    public register(
        callback: SocketMessageCallback,
        noClientsCallback: NoClientsCallback,
    ): void {
        if (
            this.messageCallback !== undefined ||
            this.noClientsCallback !== undefined
        ) {
            throw new Error('Cannot register twice');
        }

        this.messageCallback = callback;
        this.noClientsCallback = noClientsCallback;
    }

    public unregister(): void {
        if (
            this.messageCallback !== undefined ||
            this.noClientsCallback !== undefined
        ) {
            throw new Error('Cannot unregister before registering');
        }

        this.messageCallback = undefined;
        this.noClientsCallback = undefined;
    }

    public socketsForHandleName(
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

    public addSocket(socket: IpcSocket): void {
        socket
            .open()
            .then(() => {
                socket.onData(this.onData.bind(this));
                socket.onClose(this.onClose.bind(this));
            })
            .catch((err) => {
                console.error('Failed to register socket', socket, err);
            });
    }

    protected onData(socket: IpcSocket, data: any): void {
        assert(this.messageCallback !== undefined);
        this.messageCallback(socket, data);
    }

    protected onClose(socket: IpcSocket): void {
        socket.offClose();
        socket.offData();
        this.unsubscribeAll(socket);
    }

    private unsubscribeAll(socket: IpcSocket): void {
        for (const [handle, handleMap] of this.handleNameSocketsMap) {
            for (const name of handleMap.keys()) {
                this.handleSocketSubscribe(socket, {
                    handle,
                    name,
                    subscribe: false,
                });
            }
        }
    }

    public handleSocketSubscribe(
        socket: IpcSocket,
        ipcEvent: IpcSubscribeEvent,
    ): void {
        let handleMap = this.handleNameSocketsMap.get(ipcEvent.handle);
        if (handleMap === undefined) {
            if (!ipcEvent.subscribe) {
                return;
            }

            handleMap = new Map();
            this.handleNameSocketsMap.set(ipcEvent.handle, handleMap);
        }

        let socketsMap = handleMap.get(ipcEvent.name);
        if (socketsMap === undefined) {
            if (!ipcEvent.subscribe) {
                return;
            }

            socketsMap = new Map();
            handleMap.set(ipcEvent.name, socketsMap);
        }

        const modifier = ipcEvent.subscribe ? +1 : -1;
        let value = socketsMap.get(socket);
        if (value === undefined) {
            if (!ipcEvent.subscribe) {
                return;
            }

            value = 0;
        }

        value += modifier;

        if (value < 0) {
            console.error('Socket subscribe count < 0', ipcEvent, socket);
            return;
        }

        if (value === 0) {
            if (this.noClientsCallback !== undefined) {
                this.noClientsCallback(ipcEvent.handle, ipcEvent.name);
            }
            socketsMap.delete(socket);
        } else {
            socketsMap.set(socket, value);
        }
    }
}

export class IpcServiceHandlerHelper<L extends IpcService, R extends IpcClient>
    implements IpcServiceHandlerEmitter<L, R>
{
    private handlersMap = new Map<
        IpcServiceHandlerKey<L>,
        IpcServiceHandlerCallback<L, IpcServiceHandlerKey<L>>
    >();
    private noClientsHandlersMap = new Map<
        IpcServiceHandlerKey<L>,
        () => void
    >();

    public constructor(
        private socketHandler: IpcServiceRegistrySocketHandler,
        private serializer: IpcSerializer,
        private handle: string,
    ) {}

    public sendRaw(name: string, raw: any, ...args: any[]): void {
        const ipcEvent: IpcEvent = {
            handle: this.handle,
            name,
            raw: true,
        };

        if (args.length) {
            ipcEvent.args = args;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = this.serializer.serialize(ipcEvent);

        const sockets = this.socketHandler.socketsForHandleName(
            this.handle,
            name,
        );

        if (sockets === undefined) {
            return;
        }

        for (const socket of sockets) {
            socket.send(data);
            socket.send(raw);
        }
    }

    public send(name: string, ...args: any[]): void {
        const ipcEvent: IpcEvent = {
            handle: this.handle,
            name,
            args,
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = this.serializer.serialize(ipcEvent);

        const sockets = this.socketHandler.socketsForHandleName(
            this.handle,
            name,
        );

        if (sockets === undefined) {
            return;
        }

        for (const socket of sockets) {
            socket.send(data);
        }
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

    public handleMessage(ipcEvent: IpcEvent): Promise<any> {
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

                return new Proxy(() => {}, {
                    apply(_target, _thisArg, args) {
                        switch (property) {
                            case 'on':
                            case 'off':
                            case 'onNoClients':
                            case 'offNoClients':
                            case 'sendRaw':
                                Reflect.apply(
                                    ipcHandler[property],
                                    ipcHandler,
                                    args,
                                );
                                return;
                        }

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        return ipcHandler.send(property, ...args);
                    },
                });
            },
        },
    ) as IpcServiceHandler<L, R>;
};

export class GenericIpcServiceRegistry implements IpcServiceRegistry {
    protected ipcHandlers = new Map<
        string,
        IpcServiceHandlerHelper<any, any>
    >();

    public constructor(
        protected socketHandler: BaseIpcServiceRegistrySocketHandler,
        private serializer: IpcSerializer,
    ) {}

    public register(): void {
        this.socketHandler.register(
            this.handleMessage.bind(this),
            this.handleNoClients.bind(this),
        );
    }

    public unregister(): void {
        this.socketHandler.unregister();
    }

    private handleNoClients(handle: string, name: string): void {
        const ipcHandler = this.ipcHandlers.get(handle);
        if (ipcHandler === undefined) {
            return;
        }

        ipcHandler.handleNoClients(name);
    }

    private handleMessage(socket: IpcSocket, data: Uint8Array): void {
        this.handleMessageAsync(socket, data)
            .then(() => {})
            .catch((err) => {
                console.error(err);
            });
    }

    private async handleMessageAsync(
        socket: IpcSocket,
        data: Uint8Array,
    ): Promise<void> {
        const ipcEvent = this.serializer.deserialize(data);

        if ('subscribe' in ipcEvent) {
            this.socketHandler.handleSocketSubscribe(socket, ipcEvent);
            return;
        }

        assert('handle' in ipcEvent);
        assert('id' in ipcEvent);

        const ipcHandler = this.ipcHandlers.get(ipcEvent.handle);

        let replyIpcEvent: IpcEvent;

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
        const replyData = this.serializer.serialize(replyIpcEvent);

        socket.send(replyData);
    }

    public registerIpcService<L extends IpcService, R extends IpcClient>(
        handle: string,
    ): IpcServiceHandler<L, R> {
        assert(!this.ipcHandlers.has(handle));
        const ipcHandler = new IpcServiceHandlerHelper<L, R>(
            this.socketHandler,
            this.serializer,
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
