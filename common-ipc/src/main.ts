import assert from 'node:assert';
import type {
    IpcService,
    IpcClient,
    IpcEvent,
    IpcSerializer,
    IpcSocket,
    IpcSubscribeEvent,
} from './common.js';
import type { IpcClientHandlerKey } from './renderer.js';

export type IpcServiceHandlerKey<L extends IpcService> = keyof L & string;
export type IpcServiceHandlerCallback<
    L extends IpcService,
    K extends IpcServiceHandlerKey<L>,
> = L[K];

export type IpcServiceHandlerEmitter<L extends IpcService> = {
    on<K extends IpcServiceHandlerKey<L>>(
        name: K,
        cb: IpcServiceHandlerCallback<L, K>,
    ): void;
    off<K extends IpcServiceHandlerKey<L>>(name: K): void;
};

export type IpcServiceHandlerSender<R extends IpcClient> = {
    sendRaw<
        K extends IpcClientHandlerKey<R>,
        F extends R[K],
        P extends Parameters<F> & [Uint8Array],
    >(
        name: K,
        ...args: P
    ): void;
};

export type IpcServiceHandler<L extends IpcService, R extends IpcClient> = R &
    IpcServiceHandlerEmitter<L> &
    IpcServiceHandlerSender<R>;

export interface IpcServiceRegistry {
    registerIpcService<L extends IpcService, R extends IpcClient>(
        handle: string,
    ): IpcServiceHandler<L, R>;
}

export type SocketMessageCallback = (socket: IpcSocket, data: any) => void;

export interface IpcServiceRegistrySocketHandler {
    socketsForHandleName(
        handle: string,
        name: string,
    ): Iterable<IpcSocket> | undefined;
    register(callback: SocketMessageCallback): void;
    unregister(): void;
}

export abstract class BaseIpcServiceRegistrySocketHandler
    implements IpcServiceRegistrySocketHandler
{
    protected messageCallback: SocketMessageCallback | undefined;
    protected handleNameSocketsMap = new Map<
        string,
        Map<string, Map<IpcSocket, number>>
    >();

    public constructor(protected name: string) {}

    public register(callback: SocketMessageCallback): void {
        if (this.messageCallback !== undefined) {
            throw new Error('Cannot register twice');
        }

        this.messageCallback = callback;
    }

    public unregister(): void {
        if (this.messageCallback !== undefined) {
            throw new Error('Cannot unregister before registering');
        }

        this.messageCallback = undefined;
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
            socketsMap.delete(socket);
        } else {
            socketsMap.set(socket, value);
        }
    }
}

export class IpcServiceHandlerHelper<L extends IpcService>
    implements IpcServiceHandlerEmitter<L>
{
    private handlersMap = new Map<
        IpcServiceHandlerKey<L>,
        IpcServiceHandlerCallback<L, IpcServiceHandlerKey<L>>
    >();

    public constructor(
        private socketHandler: IpcServiceRegistrySocketHandler,
        private serializer: IpcSerializer,
        private handle: string,
    ) {}

    public sendRaw(name: string, raw: any): void {
        const ipcEvent: IpcEvent = {
            handle: this.handle,
            name,
            raw: true,
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
}

export const createIpcClientProxy = <L extends IpcService, R extends IpcClient>(
    ipcHandler: IpcServiceHandlerHelper<L>,
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
    protected ipcHandlers = new Map<string, IpcServiceHandlerHelper<any>>();

    public constructor(
        protected socketHandler: BaseIpcServiceRegistrySocketHandler,
        private serializer: IpcSerializer,
    ) {}

    public register(): void {
        this.socketHandler.register(this.handleMessage.bind(this));
    }

    public unregister(): void {
        this.socketHandler.unregister();
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
        const ipcHandler = new IpcServiceHandlerHelper<L>(
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
