/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
    COMMUNICATION_CHANNEL_GET_WEB_CONTENTS_ID,
    composeName,
    type MethodsMap,
} from './common.js';
import { contextBridge, ipcRenderer } from 'electron';

export const window = {
    webContents: {
        id: ipcRenderer.sendSync(COMMUNICATION_CHANNEL_GET_WEB_CONTENTS_ID),
    },
};

const composeElectronName = (
    channelName: string,
    eventName: string,
): string => {
    return composeName(
        window.webContents.id!.toString(),
        channelName,
        eventName,
    );
};

export function wireRendererMethod<E extends MethodsMap>(
    channelName: string,
    eventName: keyof E & string,
): void {
    const mainName = composeName(channelName, eventName);
    const electronName = composeElectronName(channelName, eventName);
    contextBridge.exposeInMainWorld(mainName, {
        fn: (callback: Function) =>
            ipcRenderer.on(electronName, (_event, ...args: any[]) => {
                callback(...args);
            }),
    });
}

export function wireMainMethod<E extends MethodsMap>(
    channelName: string,
    eventName: keyof E & string,
): void {
    const mainName = composeName(channelName, eventName);
    const electronName = composeElectronName(channelName, eventName);
    contextBridge.exposeInMainWorld(mainName, {
        fn: (...args: any[]): any => ipcRenderer.send(electronName, ...args),
    });
}

export function wireMainPromiseMethod<E extends MethodsMap>(
    channelName: string,
    eventName: keyof E & string,
): void {
    const mainName = composeName(channelName, eventName);
    const electronName = composeElectronName(channelName, eventName);
    contextBridge.exposeInMainWorld(mainName, {
        fn: (...args: any[]): any => ipcRenderer.invoke(electronName, ...args),
    });
}

export function wireRendererMethods<E extends MethodsMap>(
    channelName: string,
    eventNames: (keyof E & string)[],
): void {
    for (const eventName of eventNames) {
        wireRendererMethod<E>(channelName, eventName);
    }
}

export function wireMainMethods<E extends MethodsMap>(
    channelName: string,
    eventNames: (keyof E & string)[],
): void {
    for (const eventName of eventNames) {
        wireMainMethod<E>(channelName, eventName);
    }
}

export function wireMainPromiseMethods<E extends MethodsMap>(
    channelName: string,
    eventNames: (keyof E & string)[],
): void {
    for (const eventName of eventNames) {
        wireMainPromiseMethod<E>(channelName, eventName);
    }
}
