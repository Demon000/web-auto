import type { IpcRendererEvent } from 'electron/renderer';
import type { IpcClientEvent, IpcServiceEvent } from '@web-auto/common-ipc';

export const ELECTRON_IPC_COMMUNICATION_CHANNEL = 'electron-ipc';

export type IpcPreloadOnOffCallback = (
    event: IpcRendererEvent,
    ipcEvent: IpcClientEvent,
) => void;

export interface IpcPreloadExposed {
    on: (name: string, cb: IpcPreloadOnOffCallback) => void;
    off: (name: string, cb: IpcPreloadOnOffCallback) => void;
    send: (name: string, ipcEvent: IpcServiceEvent) => void;
}
