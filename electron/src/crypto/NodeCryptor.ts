import { Cryptor, DataBuffer } from '@web-auto/android-auto';
import DuplexPair from 'native-duplexpair';
import { Duplex, Readable, Writable } from 'node:stream';
import { TLSSocket, connect } from 'node:tls';
import { Mutex } from 'async-mutex';
import { getLogger } from '@web-auto/logging';
import assert from 'node:assert';

export class NodeCryptor extends Cryptor {
    private logger = getLogger(this.constructor.name);

    private connected = false;
    private cleartext?: TLSSocket;
    private encrypted?: Duplex;

    private encryptMutex = new Mutex();
    private decryptMutex = new Mutex();

    public constructor(
        protected certificateBuffer: Buffer,
        protected privateKeyBuffer: Buffer,
    ) {
        super(certificateBuffer, privateKeyBuffer);
    }
    public async start(): Promise<void> {
        assert(this.cleartext === undefined);
        assert(this.encrypted === undefined);

        const pair = new DuplexPair();

        this.cleartext = connect({
            socket: pair.socket1,
            key: this.privateKeyBuffer,
            cert: this.certificateBuffer,
            rejectUnauthorized: false,
            enableTrace: true,
        });

        this.encrypted = pair.socket2;

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
    }
    public async stop(): Promise<void> {
        const releaseEncrypt = await this.encryptMutex.acquire();
        const releaseDecrypt = await this.decryptMutex.acquire();

        assert(this.cleartext !== undefined);
        assert(this.encrypted !== undefined);

        await new Promise((resolve) => {
            assert(this.cleartext !== undefined);
            this.cleartext.once('close', resolve);
            this.cleartext.destroy();
        });

        this.cleartext = undefined;
        this.encrypted = undefined;
        this.connected = false;

        releaseDecrypt();
        releaseEncrypt();
    }
    public isHandshakeComplete(): boolean {
        return this.connected;
    }

    public async readHandshakeBuffer(): Promise<DataBuffer> {
        assert(this.encrypted !== undefined);
        return await this.read(this.encrypted);
    }

    public async writeHandshakeBuffer(buffer: DataBuffer): Promise<void> {
        assert(this.encrypted !== undefined);
        await this.write(this.encrypted, buffer);
    }

    private readSync(readable: Readable): DataBuffer {
        const buffer = DataBuffer.empty();
        let chunk;
        while (null !== (chunk = readable.read())) {
            const chunkBuffer = DataBuffer.fromBuffer(chunk);
            buffer.appendBuffer(chunkBuffer);
        }
        return buffer;
    }

    private async read(readable: Readable): Promise<DataBuffer> {
        return new Promise((resolve, reject) => {
            const buffer = this.readSync(readable);
            if (buffer.size) {
                resolve(buffer);
            } else {
                readable.once('readable', () => {
                    const buffer = this.readSync(readable);
                    if (buffer.size) {
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
        buffer: DataBuffer,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const canWrite = writeable.write(buffer.data, (err) => {
                if (err !== undefined && err !== null) {
                    return reject(err);
                }

                resolve();
            });
            assert(canWrite);
        });
    }

    public async encrypt(buffer: DataBuffer): Promise<DataBuffer> {
        assert(this.cleartext !== undefined);
        assert(this.encrypted !== undefined);

        const release = await this.encryptMutex.acquire();
        this.logger.debug('Encrypting buffer', buffer);
        try {
            await this.write(this.cleartext, buffer);
            const encrypyedBuffer = await this.read(this.encrypted);
            this.logger.debug('Encrypted buffer', encrypyedBuffer);
            return encrypyedBuffer;
        } finally {
            release();
        }
    }

    public async decrypt(buffer: DataBuffer): Promise<DataBuffer> {
        assert(this.cleartext !== undefined);
        assert(this.encrypted !== undefined);

        const release = await this.decryptMutex.acquire();
        this.logger.debug('Decrypting buffer', buffer);
        try {
            await this.write(this.encrypted, buffer);
            const decryptedBuffer = await this.read(this.cleartext);
            this.logger.debug('Decrypted buffer', decryptedBuffer);
            return decryptedBuffer;
        } finally {
            release();
        }
    }
}
