import {
    ELECTRON_IPC_COMMUNICATION_CHANNEL,
    type IpcPreloadExposed,
} from './common.js';
import { EventEmitter } from 'eventemitter3';
import type {
    IpcClient,
    IpcClientHandler,
    IpcClientRegistry,
    IpcEvent,
    IpcService,
} from '@web-auto/common-ipc';

declare const window: {
    [ELECTRON_IPC_COMMUNICATION_CHANNEL]?: IpcPreloadExposed;
};

const exposed = window[ELECTRON_IPC_COMMUNICATION_CHANNEL];

class IpcClientHandlerHelper<L extends IpcClient> {
    public emitter = new EventEmitter<L>();
    private callbacksMap = new Map<number, (ipcEvent: IpcEvent) => void>();
    private id = 0;

    public constructor(
        private exposed: IpcPreloadExposed,
        private channelName: string,
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
            this.exposed.send(this.channelName, ipcEvent);

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

function createIpcServiceProxy<L extends IpcClient, R extends IpcService>(
    ipcHandler: IpcClientHandlerHelper<L>,
): IpcClientHandler<L, R> {
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
}

export class ElectronIpcClientRegistry implements IpcClientRegistry {
    private ipcHandlers = new Map<string, IpcClientHandlerHelper<any>>();
    private exposed: IpcPreloadExposed;

    public constructor(private name: string) {
        this.handleOn = this.handleOn.bind(this);

        if (exposed === undefined) {
            throw new Error('Cannot create Electron IPC client registry');
        }

        this.exposed = exposed;
    }

    public async register(): Promise<void> {
        this.exposed.on(this.name, this.handleOn);
    }

    public async unregister(): Promise<void> {
        this.exposed.off(this.name, this.handleOn);
    }

    private handleOn(
        _event: Electron.IpcRendererEvent,
        ipcEvent: IpcEvent,
    ): void {
        if (!('handle' in ipcEvent)) {
            console.error('Expected handle in IPC event', ipcEvent);
            return;
        }

        for (const [name, ipcHandler] of this.ipcHandlers) {
            if (ipcEvent.handle !== name) {
                continue;
            }

            return ipcHandler.handleOn(ipcEvent);
        }

        console.error(`Unhandled IPC event for handler ${ipcEvent.handle}`);
    }

    public registerIpcClient<L extends IpcClient, R extends IpcService>(
        handle: string,
    ): IpcClientHandler<L, R> {
        if (this.ipcHandlers.has(handle)) {
            throw new Error(
                `IPC handler for handle ${handle} already registered`,
            );
        }

        const ipcHandler = new IpcClientHandlerHelper<L>(
            this.exposed,
            this.name,
            handle,
        );
        this.ipcHandlers.set(handle, ipcHandler);

        return createIpcServiceProxy(ipcHandler);
    }
    public unregisterIpcClient(handle: string): void {
        if (!this.ipcHandlers.has(handle)) {
            throw new Error(`IPC handler for handle ${handle} not registered`);
        }

        this.ipcHandlers.delete(handle);
    }
}
