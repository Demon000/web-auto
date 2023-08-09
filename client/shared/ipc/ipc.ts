/* eslint-disable @typescript-eslint/no-explicit-any */

export type MethodsMap = Record<string, any>;

type DefaultMethods = Record<string, (...args: any) => void>;

export abstract class CommunicationChannel<
    L extends MethodsMap = DefaultMethods,
    R extends MethodsMap = DefaultMethods,
> {
    public constructor(protected name: string) {}

    public abstract send<K extends keyof R & string>(
        eventName: K,
        ...args: Parameters<R[K]>
    ): void;

    public abstract on<K extends keyof L & string>(
        eventname: K,
        callback: L[K],
    ): void;
}

export function composeName(channelName: string, eventName: string): string {
    return `${channelName}#${eventName}`;
}

export function decomposeName(name: string): [string, string] {
    const names = name.split('#');
    if (names.length !== 2) {
        throw new Error(`Invalid name ${name}`);
    }

    return names as [string, string];
}
