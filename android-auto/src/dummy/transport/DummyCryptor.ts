import { Cryptor } from '@/crypto/Cryptor';
import { DataBuffer } from '@/utils';

export class DummyCryptor extends Cryptor {
    public init(): void {
        throw new Error('Method not implemented.');
    }
    public deinit(): void {
        throw new Error('Method not implemented.');
    }
    public doHandshake(): boolean {
        throw new Error('Method not implemented.');
    }
    public readHandshakeBuffer(): DataBuffer {
        throw new Error('Method not implemented.');
    }
    public writeHandshakeBuffer(_buffer: DataBuffer): void {
        throw new Error('Method not implemented.');
    }
    public encrypt(_output: DataBuffer, _input: DataBuffer): number {
        throw new Error('Method not implemented.');
    }
    public decrypt(_output: DataBuffer, _input: DataBuffer): number {
        throw new Error('Method not implemented.');
    }
}
