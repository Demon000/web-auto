export type IpcServiceFunction = (...args: any[]) => Promise<any>;
export type IpcClientFunction = (...args: any[]) => void;

export type IpcService = {
    [key: string]: IpcServiceFunction;
};

export type IpcClient = {
    [key: string]: IpcClientFunction;
};

export type IpcSubscribeEvent = {
    handle: string;
    name: string;
    subscribe: boolean;
};

export type IpcEvent =
    /* Client to server call */
    | {
          id: number;
          handle: string;
          name: string;
          args: any[];
      }
    /* Server to client response */
    | {
          replyToId: number;
          handle: string;
          result: any;
      }
    /* Server to client error */
    | {
          replyToId: number;
          handle: string;
          err: string;
      }
    /* Server to client message */
    | {
          handle: string;
          name: string;
          args: any[];
      }
    /* Subscribe / unsubscribe. */
    | IpcSubscribeEvent;

export interface IpcSerializer {
    serialize(ipcEvent: IpcEvent): any;
    deserialize(data: any): IpcEvent;
}

export type IpcSocketDataCallback = (socket: IpcSocket, data: any) => void;
export type IpcSocketCloseCallback = (socket: IpcSocket) => void;
export type IpcSocket = {
    send(data: any): void;
    open(): Promise<void>;
    close(): Promise<void>;
    onData(callback: IpcSocketDataCallback): void;
    offData(): void;
    onClose(callback: IpcSocketCloseCallback): void;
    offClose(): void;
};

export abstract class BaseIpcSocket implements IpcSocket {
    protected dataCallback: IpcSocketDataCallback | undefined;
    protected closeCallback: IpcSocketCloseCallback | undefined;

    public abstract send(data: any): void;
    public abstract open(): Promise<void>;
    public abstract close(): Promise<void>;

    public callOnData(data: any): void {
        if (this.dataCallback === undefined) {
            throw new Error('Received data without callback');
        }

        this.dataCallback(this, data);
    }

    public callOnClose(): void {
        if (this.closeCallback === undefined) {
            throw new Error('Received close without callback');
        }

        this.closeCallback(this);
    }

    public onData(callback: IpcSocketDataCallback): void {
        if (this.dataCallback !== undefined) {
            throw new Error('Cannot attach data callback twice');
        }

        this.dataCallback = callback;
    }

    public offData(): void {
        if (this.dataCallback === undefined) {
            throw new Error('Cannot detach unattached data callback');
        }

        this.dataCallback = undefined;
    }

    public onClose(callback: IpcSocketCloseCallback): void {
        if (this.closeCallback !== undefined) {
            throw new Error('Cannot attach close callback twice');
        }

        this.closeCallback = callback;
    }

    public offClose(): void {
        if (this.closeCallback === undefined) {
            throw new Error('Cannot detach unattached close callback');
        }

        this.closeCallback = undefined;
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
