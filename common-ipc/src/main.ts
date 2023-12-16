import assert from 'node:assert';
import type {
    IpcService,
    IpcClient,
    IpcEvent,
    IpcSerializer,
    IpcSocket,
} from './common.js';

export type IpcServiceHandler<L extends IpcService, R extends IpcClient> = R & {
    on<K extends keyof L, F extends L[K]>(
        name: K,
        cb: (...args: Parameters<F>) => ReturnType<F>,
    ): void;
    off<K extends keyof L>(name: K): void;
};

export interface IpcServiceRegistry {
    registerIpcService<L extends IpcService, R extends IpcClient>(
        handle: string,
    ): IpcServiceHandler<L, R>;
}

export type SocketMessageCallback = (socket: IpcSocket, data: any) => void;

export interface IpcServiceRegistrySocketHandler {
    get sockets(): IpcSocket[];
    register(callback: SocketMessageCallback): void;
    unregister(): void;
}

export abstract class BaseIpcServiceRegistrySocketHandler
    implements IpcServiceRegistrySocketHandler
{
    protected messageCallback?: SocketMessageCallback;
    public sockets: IpcSocket[] = [];

    public constructor(protected name: string) {
        this.onData = this.onData.bind(this);
        this.onClose = this.onClose.bind(this);
    }

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

    public addSocket(socket: IpcSocket): void {
        socket
            .open()
            .then(() => {
                socket.onData(this.onData);
                socket.onClose(this.onClose);
                this.sockets.push(socket);
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
        socket.offData();
        const socketIndex = this.sockets.indexOf(socket);
        if (socketIndex === -1) {
            console.error('IPC socket not registered');
            return;
        }

        this.sockets.splice(socketIndex, 1);
    }
}

export class IpcServiceHandlerHelper<L extends IpcService> {
    private map: Partial<L> = {};

    public constructor(
        private socketHandler: IpcServiceRegistrySocketHandler,
        private serializer: IpcSerializer,
        private handle: string,
    ) {}

    public send(name: string, ...args: any[]): void {
        const ipcEvent: IpcEvent = {
            handle: this.handle,
            name,
            args,
        };

        const data = this.serializer.serialize(ipcEvent);

        for (const socket of this.socketHandler.sockets) {
            socket.send(data);
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
};

export class GenericIpcServiceRegistry implements IpcServiceRegistry {
    protected ipcHandlers = new Map<string, IpcServiceHandlerHelper<any>>();

    public constructor(
        protected socketHandler: BaseIpcServiceRegistrySocketHandler,
        private serializer: IpcSerializer,
    ) {
        this.handleMessage = this.handleMessage.bind(this);
    }

    public register(): void {
        this.socketHandler.register(this.handleMessage);
    }

    public unregister(): void {
        this.socketHandler.unregister();
    }

    private async handleMessage(
        socket: IpcSocket,
        data: Buffer,
    ): Promise<void> {
        const ipcEvent = this.serializer.deserialize(data) as IpcEvent;

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

            const data = this.serializer.serialize(replyIpcEvent);
            socket.send(data);

            return;
        }

        throw new Error(`Unhandled IPC event for handler ${ipcEvent.handle}`);
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
