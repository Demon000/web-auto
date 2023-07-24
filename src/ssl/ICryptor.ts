import { DataBuffer } from '../utils/DataBuffer';

export interface ICryptor {
    doHandshake(): void;
    readHandshakeBuffer(): Buffer;
    writeHandshakeBuffer(buffer: Buffer): void;

    encrypt(output: DataBuffer, input: Buffer): number;
    decrypt(output: DataBuffer, input: Buffer): number;
}
