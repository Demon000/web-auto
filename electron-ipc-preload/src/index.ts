/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { MethodsMap, composeName } from '@web-auto/electron-ipc';
import { contextBridge, ipcRenderer } from 'electron';

export function wireRendererMethod<E extends MethodsMap>(
    channelName: string,
    eventName: keyof E & string,
): void {
    const name = composeName(channelName, eventName);
    contextBridge.exposeInMainWorld(name, {
        fn: (callback: Function) =>
            ipcRenderer.on(name, (_event, ...args: any[]) => {
                callback(...args);
            }),
    });
}

export function wireMainMethod<E extends MethodsMap>(
    channelName: string,
    eventName: keyof E & string,
): void {
    const name = composeName(channelName, eventName);
    contextBridge.exposeInMainWorld(name, {
        fn: (...args: any[]): any => ipcRenderer.send(name, ...args),
    });
}

export function wireMainPromiseMethod<E extends MethodsMap>(
    channelName: string,
    eventName: keyof E & string,
): void {
    const name = composeName(channelName, eventName);
    contextBridge.exposeInMainWorld(name, {
        fn: (...args: any[]): any => ipcRenderer.invoke(name, ...args),
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
