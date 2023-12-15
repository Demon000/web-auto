import type { EventEmitter } from 'eventemitter3';

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
