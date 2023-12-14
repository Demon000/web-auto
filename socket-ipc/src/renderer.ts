import { EventEmitter } from 'eventemitter3';
import type {
    IpcClient,
    IpcClientHandler,
    IpcClientRegistry,
    IpcEvent,
    IpcService,
} from '@web-auto/common-ipc';
import { BSON } from 'bson';
import { BsonDeserializeOptions } from './common.js';

class IpcClientHandlerHelper<L extends IpcClient> {
    public emitter = new EventEmitter<L>();
    private callbacksMap = new Map<number, (ipcEvent: IpcEvent) => void>();
    private id = 0;

    public constructor(
        private socket: WebSocket,
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

        const data = BSON.serialize(ipcEvent);

        return new Promise((resolve, reject) => {
            this.socket.send(data);

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

export class SocketIpcClientRegistry implements IpcClientRegistry {
    private ipcHandlers = new Map<string, IpcClientHandlerHelper<any>>();
    private socket?: WebSocket;

    public constructor(
        private host: string,
        private port: number,
        private name: string,
    ) {
        this.handleOn = this.handleOn.bind(this);
    }

    public register(): Promise<void> {
        if (this.socket !== undefined) {
            throw new Error('Cannot call register twice');
        }

        const socket = new WebSocket(
            `ws://${this.host}:${this.port}/${this.name}`,
        );

        socket.binaryType = 'arraybuffer';
        socket.onmessage = this.handleOn;

        return new Promise((resolve) => {
            socket.onopen = () => {
                resolve();
            };
            this.socket = socket;
        });
    }

    public unregister(): void {
        if (this.socket === undefined) {
            throw new Error('Cannot call unregister without calling register');
        }

        this.socket.close();
    }

    private handleOn(message: MessageEvent): void {
        const ipcEvent = BSON.deserialize(
            message.data,
            BsonDeserializeOptions,
        ) as IpcEvent;

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
        if (this.socket === undefined) {
            throw new Error(
                'Cannot register client before registering registry',
            );
        }

        if (this.ipcHandlers.has(handle)) {
            throw new Error(
                `IPC handler for handle ${handle} already registered`,
            );
        }

        const ipcHandler = new IpcClientHandlerHelper<L>(this.socket, handle);
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
