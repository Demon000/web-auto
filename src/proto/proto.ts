import { Enum, ReflectionObject, Root, load } from 'protobufjs';
import path from 'path';
import { readdir } from 'node:fs/promises';

export const protos = new Root();

export async function loadProtos(): Promise<void> {
    const protosPath = path.join(__dirname, 'protos');

    const files = await readdir(protosPath);

    for (const file of files) {
        const protoPath = path.join(protosPath, file);

        load(protoPath, protos);
    }
}

export function toFullPath(name: string): string {
    return `aasdk.proto.${name}`;
}

export function lookupProto(name: string): ReflectionObject {
    const proto = protos.lookup(toFullPath(name));
    if (proto === null) throw new Error(`Invalid proto ${name}`);
    return proto;
}

export function lookupEnum(name: string): Enum {
    return protos.lookupEnum(name);
}
