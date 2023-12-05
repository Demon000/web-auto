import type { IpcRendererEvent } from 'electron';
import type { EventEmitter } from 'eventemitter3';

export const ELECTRON_IPC_COMMUNICATION_CHANNEL = 'electron-ipc';

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

export interface IpcEvent {
    handle: string;
    name: string;
    args: any[];
}

export type IpcPreloadOnOffCallback = (
    event: IpcRendererEvent,
    ipcEvent: IpcEvent,
) => void;

export interface IpcPreloadExposed {
    on: (name: string, cb: IpcPreloadOnOffCallback) => void;
    off: (name: string, cb: IpcPreloadOnOffCallback) => void;
    invoke: (name: string, ipcEvent: IpcEvent) => Promise<any>;
}

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
