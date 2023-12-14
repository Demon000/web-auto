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
