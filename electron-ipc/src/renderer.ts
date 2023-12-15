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

    public constructor(
        private exposed: IpcPreloadExposed,
        private channelName: string,
        private handle: string,
    ) {}

    public async send(name: string, ...args: any[]): Promise<any> {
        const ipcEvent: IpcEvent = {
            handle: this.handle,
            name,
            args,
        };

        const replyIpcEvent = await this.exposed.invoke(
            this.channelName,
            ipcEvent,
        );

        if ('err' in replyIpcEvent) {
            throw new Error(replyIpcEvent.err);
        }

        if ('result' in replyIpcEvent) {
            return replyIpcEvent.result;
        } else {
            return undefined;
        }
    }

    public handleOn(ipcEvent: IpcEvent): void {
        if (!('args' in ipcEvent)) {
            throw new Error('Expected args in IPC event');
        }

        if (!('name' in ipcEvent)) {
            throw new Error('Expected args in IPC event');
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
            throw new Error('Expected handle in IPC event');
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
