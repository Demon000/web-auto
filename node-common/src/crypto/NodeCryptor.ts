import assert from 'node:assert';
import { Duplex, Readable, Writable } from 'node:stream';
import { connect, TLSSocket } from 'node:tls';

import { BufferWriter, Cryptor } from '@web-auto/android-auto';
import { getLogger } from '@web-auto/logging';
import { Mutex } from 'async-mutex';
import DuplexPair from 'native-duplexpair';

export interface NodeCryptorConfig {
    ciphers: string;
}

export class NodeCryptor extends Cryptor {
    private logger = getLogger(this.constructor.name);

    private connected = false;
    private cleartext: TLSSocket | undefined;
    private encrypted: Duplex | undefined;

    private encryptMutex = new Mutex();
    private decryptMutex = new Mutex();

    public constructor(
        private config: NodeCryptorConfig,
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ) {
        super(certificateBuffer, privateKeyBuffer);
    }

    public start(): void {
        assert(this.cleartext === undefined);
        assert(this.encrypted === undefined);

        const { socket1, socket2 } = new DuplexPair();

        this.cleartext = connect({
            socket: socket1,
            key: this.privateKeyBuffer,
            cert: this.certificateBuffer,
            rejectUnauthorized: false,
            ciphers: this.config.ciphers,
        });

        this.encrypted = socket2;

        this.cleartext.once('secureConnect', () => {
            if (this.cleartext === undefined) {
                this.logger.error('Connected after stop');
                return;
            }

            const cipher = this.cleartext.getCipher();
            this.logger.debug(
                `Connected, cipher: ${cipher.name} ${cipher.version}`,
            );

            this.connected = true;
        });

        this.cleartext.on('keylog', (line) => {
            this.logger.info('Keylog', line.toString('hex'));
        });
    }

    public stop(): void {
        assert(this.cleartext !== undefined);
        assert(this.encrypted !== undefined);

        this.cleartext.destroy();
        this.encrypted.destroy();

        this.cleartext = undefined;
        this.encrypted = undefined;
        this.connected = false;
    }

    public isHandshakeComplete(): boolean {
        return this.connected;
    }

    public async readHandshakeBuffer(): Promise<Uint8Array> {
        if (this.encrypted === undefined) {
            throw new Error('Cannot read handshake buffer after stop');
        }

        return await this.read(this.encrypted);
    }

    public async writeHandshakeBuffer(buffer: Uint8Array): Promise<void> {
        if (this.encrypted === undefined) {
            throw new Error('Cannot write handshake buffer after stop');
        }

        await this.write(this.encrypted, buffer);
    }

    private readSync(readable: Readable): Uint8Array {
        const buffer = BufferWriter.empty();
        let chunk;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        while (null !== (chunk = readable.read())) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            buffer.appendBuffer(chunk as Uint8Array);
        }
        return buffer.data;
    }

    private async read(readable: Readable): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            const buffer = this.readSync(readable);
            if (buffer.byteLength) {
                resolve(buffer);
            } else {
                readable.once('readable', () => {
                    const buffer = this.readSync(readable);
                    if (buffer.byteLength) {
                        resolve(buffer);
                    } else {
                        reject(buffer);
                    }
                });
            }
        });
    }

    private async write(
        writeable: Writable,
        buffer: Uint8Array,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const canWrite = writeable.write(buffer, (err) => {
                if (err !== undefined && err !== null) {
                    return reject(err);
                }

                resolve();
            });
            assert(canWrite);
        });
    }

    public async encrypt(buffer: Uint8Array): Promise<Uint8Array> {
        this.logger.debug('Encrypting buffer', buffer);
        const release = await this.encryptMutex.acquire();
        try {
            if (this.cleartext === undefined) {
                throw new Error('Cannot encrypt after stop');
            }
            await this.write(this.cleartext, buffer);
            if (this.encrypted === undefined) {
                throw new Error('Cannot encrypt after stop');
            }
            const encrypyedBuffer = await this.read(this.encrypted);
            this.logger.debug('Encrypted buffer', encrypyedBuffer);
            return encrypyedBuffer;
        } finally {
            release();
        }
    }

    public async decrypt(buffer: Uint8Array): Promise<Uint8Array> {
        this.logger.debug('Decrypting buffer', buffer);
        const release = await this.decryptMutex.acquire();
        try {
            if (this.encrypted === undefined) {
                throw new Error('Cannot encrypt after stop');
            }
            await this.write(this.encrypted, buffer);
            if (this.cleartext === undefined) {
                throw new Error('Cannot encrypt after stop');
            }
            const decryptedBuffer = await this.read(this.cleartext);
            this.logger.debug('Decrypted buffer', decryptedBuffer);
            return decryptedBuffer;
        } finally {
            release();
        }
    }
}
