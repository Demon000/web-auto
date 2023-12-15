import { EventEmitter } from 'eventemitter3';

export type IpcServiceFunction = (...args: any[]) => Promise<any>;
export type IpcClientFunction = (...args: any[]) => void;

export type IpcService = {
    [key: string]: IpcServiceFunction;
};

export type IpcClient = {
    [key: string]: IpcClientFunction;
};

export type IpcClientHandler<L extends IpcClient, R extends IpcService> = R &
    Pick<EventEmitter<L>, 'on' | 'off' | 'once'>;

export type IpcServiceHandler<L extends IpcService, R extends IpcClient> = R & {
    on<K extends keyof L, F extends L[K]>(
        name: K,
        cb: (...args: Parameters<F>) => ReturnType<F>,
    ): void;
    off<K extends keyof L>(name: K): void;
};

export interface IpcSerializer {
    serialize(ipcEvent: IpcEvent): any;
    deserialize(data: any): IpcEvent;
}

export type IpcSocketDataCallback = (data: any) => void;
export type IpcSocketCloseCallback = () => void;
export type IpcSocket = {
    send(data: any): void;
    open(): Promise<void>;
    close(): Promise<void>;
    onData(callback: IpcSocketDataCallback): void;
    offData(callback: IpcSocketDataCallback): void;
};

export type IpcMessengerOnCallback = (ipcEvent: IpcEvent) => void;

export class IpcMessenger {
    private callbacksMap = new Map<string, IpcMessengerOnCallback>();

    public constructor(
        private serializer: IpcSerializer,
        private socket: IpcSocket,
    ) {
        this.onData = this.onData.bind(this);
    }

    public async register(): Promise<void> {
        await this.socket.open();
        this.socket.onData(this.onData);
    }

    public async unregister(): Promise<void> {
        this.socket.offData(this.onData);
        await this.socket.close();
    }

    public send(ipcEvent: IpcEvent): void {
        const data = this.serializer.serialize(ipcEvent);
        this.socket.send(data);
    }

    protected handleMessage(ipcEvent: IpcEvent): void {
        if (!('handle' in ipcEvent)) {
            console.error('Expected handle in IPC event', ipcEvent);
            return;
        }

        for (const [handle, callback] of this.callbacksMap) {
            if (handle === ipcEvent.handle) {
                return callback(ipcEvent);
            }
        }

        console.error(`Unhandled IPC event for handler ${ipcEvent.handle}`);
    }

    private onData(data: any): void {
        const ipcEvent = this.serializer.deserialize(data);
        this.handleMessage(ipcEvent);
    }

    public on(handle: string, callback: IpcMessengerOnCallback): void {
        if (this.callbacksMap.has(handle)) {
            throw new Error(`IPC handler ${handle} already registered`);
        }

        this.callbacksMap.set(handle, callback);
    }

    public off(handle: string): void {
        if (!this.callbacksMap.has(handle)) {
            throw new Error(`IPC handler ${handle} not registered`);
        }

        this.callbacksMap.delete(handle);
    }
}

export class DummyIpcSerializer implements IpcSerializer {
    public constructor() {}

    public serialize(ipcEvent: IpcEvent): any {
        return ipcEvent;
    }

    public deserialize(data: any): IpcEvent {
        return data as IpcEvent;
    }
}

export type IpcEvent =
    /* Replies unsupported. */
    | {
          id: number;
          handle: string;
          name: string;
          args: any[];
      }
    | {
          replyToId: number;
          handle: string;
          args: any[];
      }
    | {
          replyToId: number;
          handle: string;
          err: string;
      }
    /* Replies supported. */
    | {
          handle: string;
          name: string;
          args: any[];
      }
    | {
          result: any;
      }
    | {
          err: string;
      }
    /* Subscription. */
    | {
          type: 'subscribe';
          handle: string;
      }
    | {
          type: 'unsubscribe';
          handle: string;
      };

export interface IpcServiceRegistry {
    registerIpcService<L extends IpcService, R extends IpcClient>(
        handle: string,
    ): IpcServiceHandler<L, R>;
}

export interface IpcClientRegistry {
    registerIpcClient<L extends IpcClient, R extends IpcService>(
        handle: string,
    ): IpcClientHandler<L, R>;
    unregisterIpcClient(handle: string): void;
}
