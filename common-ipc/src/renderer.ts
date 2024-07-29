import type {
    IpcClient,
    IpcClientEvent,
    IpcClientHandlerKey,
    IpcService,
    IpcServiceEvent,
    IpcSocket,
    IpcSocketCreateCallback,
    IpcSubscribeEvent,
} from './common.js';

export type IpcClientHandlerCallback<
    L extends IpcClient,
    K extends IpcClientHandlerKey<L>,
    F extends L[K],
> = (...args: Parameters<F>) => ReturnType<F>;

export type IpcClientHandler<L extends IpcClient, R extends IpcService> = R &
    Pick<IpcClientHandlerHelper<L, R>, 'on' | 'off' | 'send' | 'handle'> & {
        helper: IpcClientHandlerHelper<L, R>;
    };

export class IpcClientHandlerHelper<L extends IpcClient, R extends IpcService> {
    private callbacksMap = new Map<
        number,
        (ipcEvent: IpcClientEvent) => void
    >();
    private listenersMap = new Map<
        IpcClientHandlerKey<L>,
        IpcClientHandlerCallback<L, any, any>[]
    >();
    private id = 0;

    public constructor(
        private socket: IpcSocket,
        public handle: string,
    ) {}

    private getId(): number {
        if (this.id >= Number.MAX_SAFE_INTEGER) {
            this.id = 0;
        }

        return this.id++;
    }

    public send<
        K extends IpcClientHandlerKey<R>,
        F extends R[K],
        P extends Parameters<F>,
        E extends ReturnType<F>,
    >(name: K, ...args: P): Promise<E> {
        const id = this.getId();
        const ipcEvent: IpcServiceEvent = {
            id,
            handle: this.handle,
            name,
            args,
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = this.socket.serializer.serialize(ipcEvent);

        return new Promise((resolve, reject) => {
            this.socket.send(data);

            this.callbacksMap.set(id, (replyIpcEvent) => {
                this.callbacksMap.delete(id);

                if ('err' in replyIpcEvent) {
                    reject(new Error(replyIpcEvent.err));
                    return;
                }

                if ('result' in replyIpcEvent) {
                    resolve(replyIpcEvent.result as E);
                } else {
                    resolve(undefined as E);
                }
            });
        });
    }

    public handleOn(ipcEvent: IpcClientEvent, raw?: any): void {
        if ('replyToId' in ipcEvent) {
            const callback = this.callbacksMap.get(ipcEvent.replyToId);
            if (callback === undefined) {
                throw new Error(`Unhandled reply for id ${ipcEvent.replyToId}`);
            }

            callback(ipcEvent);
        } else {
            let args;
            if (raw === undefined && 'args' in ipcEvent) {
                args = ipcEvent.args;
            } else if (raw !== undefined && 'args' in ipcEvent) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                args = [raw, ...ipcEvent.args];
            } else if (raw !== undefined) {
                args = [raw];
            } else {
                console.error('Expected args in IPC event', ipcEvent);
                return;
            }

            const listeners = this.listenersMap.get(ipcEvent.name);
            if (listeners === undefined) {
                return;
            }

            for (const listener of listeners) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                listener(...args);
            }
        }
    }

    public subscribe(name: string, subscribe: boolean): void {
        const ipcEvent: IpcSubscribeEvent = {
            handle: this.handle,
            name,
            subscribe,
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = this.socket.serializer.serialize(ipcEvent);

        this.socket.send(data);
    }

    public on<K extends IpcClientHandlerKey<L>, F extends L[K]>(
        name: K,
        cb: IpcClientHandlerCallback<L, K, F>,
    ): void {
        let listeners = this.listenersMap.get(name);
        if (listeners === undefined) {
            listeners = [];
            this.listenersMap.set(name, listeners);
        }

        listeners.push(cb);
        this.subscribe(name, true);
    }

    public off<K extends IpcClientHandlerKey<L>, F extends L[K]>(
        name: K,
        cb: IpcClientHandlerCallback<L, K, F>,
    ): void {
        const listeners = this.listenersMap.get(name);
        if (listeners === undefined) {
            throw new Error(`Listeners for ${String(name)} not added`);
        }

        const index = listeners.indexOf(cb);
        if (index === -1) {
            throw new Error(`Listener for ${String(name)} not added`);
        }

        listeners.splice(index, 1);
        this.subscribe(name, false);
    }
}

export const createIpcServiceProxy = <
    L extends IpcClient,
    R extends IpcService,
>(
    ipcHandler: IpcClientHandlerHelper<L, R>,
): IpcClientHandler<L, R> => {
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

                if (property == 'handle') {
                    return Reflect.get(ipcHandler, property);
                }

                return new Proxy(() => {}, {
                    apply(_target, _thisArg, args) {
                        switch (property) {
                            case 'on':
                            case 'off':
                            case 'send':
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
    ) as IpcClientHandler<L, R>;
};

export interface IpcClientRegistry {
    register(): Promise<void>;
    registerIpcClient<L extends IpcClient, R extends IpcService>(
        handle: string,
    ): IpcClientHandler<L, R>;
    unregisterIpcClient(handle: string): void;
}

export interface GenericIpcClientRegistryEvents {
    open(): void;
    close(): void;
}

export class GenericIpcClientRegistry implements IpcClientRegistry {
    private ipcHandlers = new Map<string, IpcClientHandlerHelper<any, any>>();
    private rawIpcEvent: IpcClientEvent | undefined;
    private socket: IpcSocket;

    public constructor(cb: IpcSocketCreateCallback) {
        this.socket = cb({
            onSocketData: this.onData.bind(this),
            onSocketClose: this.onClose.bind(this),
        });
    }

    public async register(): Promise<void> {
        await this.socket.open();
    }

    public async unregister(): Promise<void> {
        await this.socket.close();
    }

    protected handleMessage(ipcEvent: IpcClientEvent): void {
        if ('raw' in ipcEvent) {
            this.rawIpcEvent = ipcEvent;
            return;
        }

        if (!('handle' in ipcEvent)) {
            console.error('Expected handle in IPC event', ipcEvent);
            return;
        }

        const ipcHandler = this.ipcHandlers.get(ipcEvent.handle);
        if (ipcHandler !== undefined) {
            return ipcHandler.handleOn(ipcEvent);
        }

        console.error(`Unhandled IPC event for handler ${ipcEvent.handle}`);
    }

    protected handleRaw(ipcEvent: IpcClientEvent, raw: any): void {
        const ipcHandler = this.ipcHandlers.get(ipcEvent.handle);
        if (ipcHandler !== undefined) {
            return ipcHandler.handleOn(ipcEvent, raw);
        }

        console.error(`Unhandled IPC event for handler ${ipcEvent.handle}`);
    }

    private onClose(): void {}

    private onData(socket: IpcSocket, data: any): void {
        const rawIpcEvent = this.rawIpcEvent;
        if (rawIpcEvent !== undefined) {
            this.rawIpcEvent = undefined;
            this.handleRaw(rawIpcEvent, data);
            return;
        }

        const ipcEvent = socket.serializer.deserialize(data) as IpcClientEvent;
        this.handleMessage(ipcEvent);
    }

    public registerIpcClient<L extends IpcClient, R extends IpcService>(
        handle: string,
    ): IpcClientHandler<L, R> {
        let ipcHandler = this.ipcHandlers.get(handle);
        if (ipcHandler === undefined) {
            ipcHandler = new IpcClientHandlerHelper<L, R>(this.socket, handle);
            this.ipcHandlers.set(handle, ipcHandler);
        }

        return createIpcServiceProxy(ipcHandler) as IpcClientHandler<L, R>;
    }
    public unregisterIpcClient(handle: string): void {
        if (!this.ipcHandlers.has(handle)) {
            throw new Error(`IPC handler ${handle} not registered`);
        }

        this.ipcHandlers.delete(handle);
    }
}
