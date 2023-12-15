import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import {
    type IpcEvent,
    type IpcClient,
    type IpcService,
    type IpcServiceHandler,
    type IpcServiceRegistry,
} from '@web-auto/common-ipc';
import assert from 'node:assert';

export type ElectronIpcServiceHandlerExtra = {
    attachWindow(window: BrowserWindow): void;
    detachWindow(window: BrowserWindow): void;
};

export type ElectronIpcServiceHandler<
    L extends IpcService,
    R extends IpcClient,
> = IpcServiceHandler<L, R> & ElectronIpcServiceHandlerExtra;

class ElectronIpcServiceHandlerHelper<L extends IpcService>
    implements ElectronIpcServiceHandlerExtra
{
    private map: Partial<L> = {};

    private windows: BrowserWindow[] = [];

    public constructor(
        private channelName: string,
        private handle: string,
    ) {}

    public attachWindow(window: BrowserWindow): void {
        if (this.windows.includes(window)) {
            return;
        }

        window.webContents.once('destroyed', () => {
            this.detachWindow(window);
        });

        this.windows.push(window);
    }

    public detachWindow(window: BrowserWindow): void {
        const index = this.windows.findIndex((w) => w == window);
        if (index === -1) {
            return;
        }

        this.windows.splice(index, 1);
    }

    public send(name: string, ...args: any[]): void {
        const ipcEvent: IpcEvent = {
            handle: this.handle,
            name,
            args,
        };

        for (const window of this.windows) {
            window.webContents.send(this.channelName, ipcEvent);
        }
    }

    public on<K extends keyof L, F extends L[K]>(
        name: K,
        cb: (...args: Parameters<F>) => ReturnType<F>,
    ): void {
        assert(!(name in this.map));
        this.map[name] = cb as any;
    }

    public off<K extends keyof L>(name: K): void {
        assert(name in this.map);
        delete this.map[name];
    }

    public async handleInvoke(
        _event: IpcMainInvokeEvent,
        ipcEvent: IpcEvent,
    ): Promise<any> {
        assert('name' in ipcEvent);

        const handlerFn = this.map[ipcEvent.name];
        assert(handlerFn !== undefined);

        assert('args' in ipcEvent);

        return handlerFn(...(ipcEvent.args as any));
    }
}

function createIpcClientProxy<L extends IpcService, R extends IpcClient>(
    ipcHandler: ElectronIpcServiceHandlerHelper<L>,
): ElectronIpcServiceHandler<L, R> {
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
                            case 'attachWindow':
                            case 'detachWindow':
                            case 'on':
                            case 'off':
                                return Reflect.apply(
                                    ipcHandler[property],
                                    ipcHandler,
                                    args,
                                );
                        }

                        return ipcHandler.send(property, ...args);
                    },
                });
            },
        },
    ) as ElectronIpcServiceHandler<L, R>;
}

export class ElectronIpcServiceRegistry implements IpcServiceRegistry {
    private ipcHandlers = new Map<
        string,
        ElectronIpcServiceHandlerHelper<any>
    >();

    public constructor(private name: string) {}

    public register() {
        ipcMain.handle(this.name, this.handleInvoke.bind(this));
    }

    public unregister() {
        ipcMain.removeHandler(this.name);
    }

    private async handleInvoke(
        event: Electron.IpcMainInvokeEvent,
        ipcEvent: IpcEvent,
    ): Promise<any> {
        assert('handle' in ipcEvent);

        for (const [name, ipcHandler] of this.ipcHandlers) {
            if (ipcEvent.handle !== name) {
                continue;
            }

            let replyIpcEvent: IpcEvent;
            try {
                const result = await ipcHandler.handleInvoke(event, ipcEvent);
                replyIpcEvent = {
                    handle: ipcEvent.handle,
                    result,
                };
            } catch (err) {
                assert(err instanceof Error);
                replyIpcEvent = {
                    handle: ipcEvent.handle,
                    err: err.message,
                };
            }

            return replyIpcEvent;
        }

        throw new Error(`Unhandled IPC event for handler ${ipcEvent.handle}`);
    }

    public registerIpcService<L extends IpcService, R extends IpcClient>(
        handle: string,
    ): ElectronIpcServiceHandler<L, R> {
        assert(!this.ipcHandlers.has(handle));
        const ipcHandler = new ElectronIpcServiceHandlerHelper<L>(
            this.name,
            handle,
        );
        this.ipcHandlers.set(handle, ipcHandler);

        return createIpcClientProxy(ipcHandler);
    }

    public unregisterIpcService(handle: string): void {
        assert(this.ipcHandlers.has(handle));
        this.ipcHandlers.delete(handle);
    }

    public attachWindow(window: BrowserWindow): void {
        for (const ipcHandler of this.ipcHandlers) {
            ipcHandler.attachWindow(window);
        }
    }
}
