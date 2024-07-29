export type IpcServiceFunction = (...args: any[]) => Promise<any>;
export type IpcClientFunction = (...args: any[]) => void;

export type IpcService = {
    [key: string]: IpcServiceFunction;
};

export type IpcClient = {
    [key: string]: IpcClientFunction;
};

export type IpcClientHandlerKey<L extends IpcClient> = keyof L & string;
export type IpcServiceHandlerKey<L extends IpcService> = keyof L & string;

export type IpcResponseEvent = {
    replyToId: number;
    handle: string;
    result: any;
};

export type IpcErrorResponseEvent = {
    replyToId: number;
    handle: string;
    err: string;
};

export type IpcNotificationEvent = {
    handle: string;
    name: string;
    args: any[];
};

export type IpcRawNotificationEvent = {
    handle: string;
    name: string;
    args?: any[];
    raw: true;
};

export type IpcClientEvent =
    | IpcResponseEvent
    | IpcErrorResponseEvent
    | IpcNotificationEvent
    | IpcRawNotificationEvent;

export type IpcCallEvent = {
    id: number;
    handle: string;
    name: string;
    args: any[];
};

export type IpcSubscribeEvent = {
    handle: string;
    name: string;
    subscribe: boolean;
};

export type IpcServiceEvent = IpcCallEvent | IpcSubscribeEvent;

export type IpcEvent = IpcClientEvent | IpcServiceEvent;

export interface IpcSerializer {
    serialize(ipcEvent: IpcEvent): any;
    deserialize(data: any): IpcEvent;
}

export type IpcSocketOpenCallback = (socket: IpcSocket) => void;
export type IpcSocketDataCallback = (socket: IpcSocket, data: any) => void;
export type IpcSocketCloseCallback = (socket: IpcSocket) => void;
export type IpcSocket = {
    serializer: IpcSerializer;
    send(data: any): void;
    open(): Promise<void>;
    close(): Promise<void>;
};

export interface IpcSocketEvents {
    onSocketData: IpcSocketDataCallback;
    onSocketClose: IpcSocketCloseCallback;
}

export type IpcSocketCreateCallback = (events: IpcSocketEvents) => IpcSocket;

export abstract class BaseIpcSocket implements IpcSocket {
    public constructor(
        public serializer: IpcSerializer,
        private events: IpcSocketEvents,
    ) {}

    public abstract send(data: any): void;
    public abstract open(): Promise<void>;
    public abstract close(): Promise<void>;

    protected callOnData(data: any): void {
        this.events.onSocketData(this, data);
    }

    protected callOnClose(): void {
        this.events.onSocketClose(this);
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
