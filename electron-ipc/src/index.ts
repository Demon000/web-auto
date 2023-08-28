/* eslint-disable @typescript-eslint/no-explicit-any */

export type MethodsMap = Record<string, any>;

export const COMMUNICATION_CHANNEL_GET_WEB_CONTENTS_ID = 'get-web-contents-id';

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

export function composeName(...args: string[]): string {
    return args.join('#');
}

export function decomposeName(name: string): string[] {
    const names = name.split('#');
    return names;
}
