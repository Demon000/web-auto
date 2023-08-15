import {
    CommunicationChannel,
    composeName,
    type MethodsMap,
} from '@web-auto/electron-ipc';

export class RendererCommuncationChannel<
    L extends MethodsMap,
    R extends MethodsMap,
> extends CommunicationChannel<L, R> {
    public send<K extends keyof R & string>(
        eventName: K,
        ...args: Parameters<R[K]>
    ): void {
        const name = composeName(this.name, eventName);
        (window as Record<string, any>)[name].fn(...args);
    }

    public async invoke<K extends keyof R & string>(
        eventName: K,
        ...args: Parameters<R[K]>
    ): Promise<Awaited<ReturnType<R[K]>>> {
        const name = composeName(this.name, eventName);
        return (window as Record<string, any>)[name].fn(...args);
    }

    public on<K extends keyof L & string>(eventName: K, callback: L[K]): void {
        const name = composeName(this.name, eventName);
        (window as Record<string, any>)[name].fn(callback);
    }
}
