import { Enum, Message, Root, Type, load } from 'protobufjs';
import path from 'path';
import { readdir } from 'node:fs/promises';
import { DataBuffer } from '../utils/DataBuffer';

export const protos = new Root();

export async function loadProtos(): Promise<void> {
    const protosPath = path.join(__dirname, 'protos');

    const files = await readdir(protosPath);

    for (const file of files) {
        const protoPath = path.join(protosPath, file);

        load(protoPath, protos);
    }
}

export function lookupType(name: string): Type {
    return protos.lookupType(name);
}

export function lookupEnum(name: string): Enum {
    return protos.lookupEnum(name + '.Enum');
}

export function encodeType(type: Type, message: Message): DataBuffer {
    return DataBuffer.fromBuffer(Buffer.from(type.encode(message).finish()));
}

export function createEncodedType(
    type: Type,
    properties?: { [k: string]: any },
): DataBuffer {
    const message = type.create(properties);
    return encodeType(type, message);
}
