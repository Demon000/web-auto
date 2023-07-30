import { DataBuffer } from '../utils/DataBuffer';

export interface ICryptor {
    doHandshake(): void;
    readHandshakeBuffer(): Buffer;
    writeHandshakeBuffer(buffer: Buffer): void;

    encrypt(output: DataBuffer, input: DataBuffer): number;
    decrypt(output: DataBuffer, input: DataBuffer): number;
}
