import EventEmitter from 'eventemitter3';
import type {
    IpcClient,
    IpcEvent,
    IpcMessenger,
    IpcService,
    IpcClientHandler,
    IpcClientRegistry,
} from './common.js';

export class IpcClientHandlerHelper<L extends IpcClient> {
    public emitter = new EventEmitter<L>();
    private callbacksMap = new Map<number, (ipcEvent: IpcEvent) => void>();
    private id = 0;

    public constructor(
        private messenger: IpcMessenger,
        private handle: string,
    ) {}

    private getId(): number {
        if (this.id >= Number.MAX_SAFE_INTEGER) {
            this.id = 0;
        }

        return this.id++;
    }

    public send(name: string, ...args: any[]): Promise<any> {
        const id = this.getId();
        const ipcEvent: IpcEvent = {
            id,
            handle: this.handle,
            name,
            args,
        };

        return new Promise((resolve, reject) => {
            this.messenger.send(ipcEvent);

            this.callbacksMap.set(id, (replyIpcEvent) => {
                this.callbacksMap.delete(id);

                if ('err' in replyIpcEvent) {
                    reject(new Error(replyIpcEvent.err));
                    return;
                }

                if ('result' in replyIpcEvent) {
                    resolve(replyIpcEvent.result);
                } else {
                    resolve(undefined);
                }
            });
        });
    }

    public handleOn(ipcEvent: IpcEvent): void {
        if ('replyToId' in ipcEvent) {
            const callback = this.callbacksMap.get(ipcEvent.replyToId);
            if (callback === undefined) {
                throw new Error(`Unhandled reply for id ${ipcEvent.replyToId}`);
            }

            callback(ipcEvent);
        } else {
            if (!('args' in ipcEvent)) {
                console.error('Expected args in IPC event', ipcEvent);
                return;
            }

            this.emitter.emit(
                ipcEvent.name as EventEmitter.EventNames<L>,
                ...(ipcEvent.args as EventEmitter.EventArgs<
                    L,
                    EventEmitter.EventNames<L>
                >),
            );
        }
    }
}

export const createIpcServiceProxy = <
    L extends IpcClient,
    R extends IpcService,
>(
    ipcHandler: IpcClientHandlerHelper<L>,
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

                return new Proxy(() => {}, {
                    apply(_target, _thisArg, args) {
                        switch (property) {
                            case 'on':
                            case 'off':
                            case 'once':
                                return Reflect.apply(
                                    ipcHandler.emitter[property],
                                    ipcHandler.emitter,
                                    args,
                                );
                        }

                        return ipcHandler.send(property, ...args);
                    },
                });
            },
        },
    ) as IpcClientHandler<L, R>;
};

export class GenericIpcClientRegistry implements IpcClientRegistry {
    public constructor(private messenger: IpcMessenger) {}

    public async register(): Promise<void> {
        await this.messenger.register();
    }

    public async unregister(): Promise<void> {
        await this.messenger.unregister();
    }

    public registerIpcClient<L extends IpcClient, R extends IpcService>(
        handle: string,
    ): IpcClientHandler<L, R> {
        const ipcHandler = new IpcClientHandlerHelper<L>(
            this.messenger,
            handle,
        );

        this.messenger.on(handle, ipcHandler.handleOn);

        return createIpcServiceProxy(ipcHandler);
    }
    public unregisterIpcClient(handle: string): void {
        this.messenger.off(handle);
    }
}
