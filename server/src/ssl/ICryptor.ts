import { DataBuffer } from '../utils/DataBuffer';

export interface ICryptor {
    doHandshake(): void;
    readHandshakeBuffer(): DataBuffer;
    writeHandshakeBuffer(buffer: DataBuffer): void;

    encrypt(output: DataBuffer, input: DataBuffer): number;
    decrypt(output: DataBuffer, input: DataBuffer): number;
}
