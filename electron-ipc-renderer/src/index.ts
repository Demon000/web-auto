import {
    CommunicationChannel,
    composeName,
    MethodsMap,
} from '@web-auto/electron-ipc';

export class RendererCommuncationChannel<
    L extends MethodsMap,
    R extends MethodsMap,
> extends CommunicationChannel<L, R> {
    public checkWindow(name: string, eventName: string): void {
        if (name in window) {
            return;
        }

        throw new Error(
            `Channel ${this.name}, event ${eventName} not exposed on window`,
        );
    }
    public send<K extends keyof R & string>(
        eventName: K,
        ...args: Parameters<R[K]>
    ): void {
        const name = composeName(this.name, eventName);
        this.checkWindow(name, eventName);
        (window as Record<string, any>)[name].fn(...args);
    }

    public async invoke<K extends keyof R & string>(
        eventName: K,
        ...args: Parameters<R[K]>
    ): Promise<Awaited<ReturnType<R[K]>>> {
        const name = composeName(this.name, eventName);
        this.checkWindow(name, eventName);
        return (window as Record<string, any>)[name].fn(...args);
    }

    public on<K extends keyof L & string>(eventName: K, callback: L[K]): void {
        const name = composeName(this.name, eventName);
        this.checkWindow(name, eventName);
        (window as Record<string, any>)[name].fn(callback);
    }
}
