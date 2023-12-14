import type { IpcRendererEvent } from 'electron/renderer';
import type { IpcEvent } from '@web-auto/common-ipc';

export const ELECTRON_IPC_COMMUNICATION_CHANNEL = 'electron-ipc';

export type IpcPreloadOnOffCallback = (
    event: IpcRendererEvent,
    ipcEvent: IpcEvent,
) => void;

export interface IpcPreloadExposed {
    on: (name: string, cb: IpcPreloadOnOffCallback) => void;
    off: (name: string, cb: IpcPreloadOnOffCallback) => void;
    invoke: (name: string, ipcEvent: IpcEvent) => Promise<IpcEvent>;
}
