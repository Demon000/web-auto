import { Cryptor, DataBuffer } from '@web-auto/android-auto';
import DuplexPair from 'native-duplexpair';
import { Duplex, Readable, Writable } from 'node:stream';
import { TLSSocket, connect } from 'node:tls';
import { getLogger } from '@web-auto/logging';
import assert from 'node:assert';
import { Mutex } from 'async-mutex';
import { ChunkTransform } from './ChunkTransform.js';

export interface NodeCryptorConfig {
    ciphers: string;
}

export class NodeCryptor extends Cryptor {
    private logger = getLogger(this.constructor.name);

    private connected = false;
    private cleartext?: TLSSocket;
    private encrypted?: Duplex;

    private encryptMutex = new Mutex();
    private decryptMutex = new Mutex();
    private packetOverhead?: number;
    private cleartextTransform?: ChunkTransform;
    private encryptedTransform?: ChunkTransform;
    private op = 0;
    private currentEncryptOps = 0;
    private currentDecryptOps = 0;

    public constructor(
        private config: NodeCryptorConfig,
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
            ciphers: this.config.ciphers,
        });

        this.encrypted = pair.socket2;

        this.cleartextTransform = new ChunkTransform();
        this.encryptedTransform = new ChunkTransform(this.logger);

        this.cleartext.once('secureConnect', () => {
            if (this.cleartext === undefined) {
                this.logger.error('Connected after stop');
                return;
            }

            const cipher = this.cleartext.getCipher();

            switch (cipher.name) {
                case 'ECDHE-RSA-AES128-GCM-SHA256':
                    this.packetOverhead = 29;
                    break;
            }

            this.logger.debug(
                `Connected, cipher: ${cipher.name} ${cipher.version}`,
            );

            this.connected = true;
            this.switchToFlowing();
        });
    }

    public async destroyDuplex(duplex: Duplex): Promise<void> {
        return new Promise((resolve) => {
            duplex.once('close', resolve);
            duplex.destroy();
        });
    }

    public async stop(): Promise<void> {
        const releaseEncrypt = await this.encryptMutex.acquire();
        const releaseDecrypt = await this.decryptMutex.acquire();

        assert(this.cleartext !== undefined);
        assert(this.encrypted !== undefined);
        assert(this.cleartextTransform !== undefined);
        assert(this.encryptedTransform !== undefined);

        await Promise.all([
            this.destroyDuplex(this.cleartext),
            this.destroyDuplex(this.encrypted),
            this.destroyDuplex(this.cleartextTransform),
            this.destroyDuplex(this.encryptedTransform),
        ]);

        this.packetOverhead = undefined;
        this.cleartext = undefined;
        this.encrypted = undefined;
        this.cleartextTransform = undefined;
        this.encryptedTransform = undefined;
        this.connected = false;

        releaseDecrypt();
        releaseEncrypt();
    }

    public switchToFlowing(): void {
        assert(this.cleartext !== undefined);
        assert(this.encrypted !== undefined);
        assert(this.cleartextTransform !== undefined);
        assert(this.encryptedTransform !== undefined);

        this.cleartext.pipe(this.cleartextTransform);
        this.encrypted.pipe(this.encryptedTransform);
    }

    public isHandshakeComplete(): boolean {
        return this.connected;
    }

    public async readHandshakeBuffer(): Promise<DataBuffer> {
        assert(this.encrypted !== undefined);
        return await this.read(this.encrypted, this.op++);
    }

    public async writeHandshakeBuffer(buffer: DataBuffer): Promise<void> {
        assert(this.encrypted !== undefined);
        await this.write(this.encrypted, buffer, this.op++);
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

    private async read(readable: Readable, op: number): Promise<DataBuffer> {
        return new Promise((resolve, reject) => {
            this.logger.debug(`${op} Started read`);
            const buffer = this.readSync(readable);
            if (buffer.size) {
                this.logger.debug(`${op} Finished read immediately`);
                resolve(buffer);
            } else {
                readable.once('readable', () => {
                    const buffer = this.readSync(readable);
                    if (buffer.size) {
                        this.logger.debug(`${op} Finished read later`);
                        resolve(buffer);
                    } else {
                        this.logger.debug(`${op} Failed read`);
                        reject(buffer);
                    }
                });
            }
        });
    }

    private async write(
        writeable: Writable,
        buffer: DataBuffer,
        op: number,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.logger.debug(`${op} Started write`);
            const canWrite = writeable.write(buffer.data, (err) => {
                if (err !== undefined && err !== null) {
                    this.logger.debug(`${op} Failed write`);
                    return reject(err);
                }

                this.logger.debug(`${op} Finished write`);
                resolve();
            });
            assert(canWrite);
        });
    }

    public async encrypt(buffer: DataBuffer): Promise<DataBuffer> {
        assert(this.cleartext !== undefined);
        assert(this.encryptedTransform !== undefined);
        assert(this.packetOverhead !== undefined);

        const op = this.op++;
        this.logger.debug(`${op} Encrypting buffer`, buffer);
        this.logger.debug(`Current encrypt ops ${++this.currentEncryptOps}`);
        if (this.currentEncryptOps > 1) {
            this.logger.error('Multiple concurrent encrypts');
        }
        const size = buffer.size + this.packetOverhead;
        this.logger.debug(`${op} Add encrypted size ${size}`);
        this.encryptedTransform.addSize(size);

        const release = await this.encryptMutex.acquire();
        try {
            await this.write(this.cleartext, buffer, op);
            const encrypyedBuffer = await this.read(
                this.encryptedTransform,
                op,
            );

            this.logger.debug(
                `Current encrypt ops ${--this.currentEncryptOps}`,
            );
            this.logger.debug(`${op} Encrypted buffer`, encrypyedBuffer);
            return encrypyedBuffer;
        } finally {
            release();
        }
    }

    public async decrypt(buffer: DataBuffer): Promise<DataBuffer> {
        assert(this.encrypted !== undefined);
        assert(this.cleartextTransform !== undefined);
        assert(this.packetOverhead !== undefined);

        const op = this.op++;
        this.logger.debug(`${op} Decrypting buffer`, buffer);
        this.logger.debug(`Current decrypt ops ${++this.currentDecryptOps}`);
        const size = buffer.size - this.packetOverhead;
        this.logger.debug(`${op} Add decrypted size ${size}`);
        this.cleartextTransform.addSize(size);
        const release = await this.decryptMutex.acquire();
        try {
            await this.write(this.encrypted, buffer, op);
            const decryptedBuffer = await this.read(
                this.cleartextTransform,
                op,
            );
            this.logger.debug(
                `Current decrypt ops ${--this.currentDecryptOps}`,
            );
            this.logger.debug(`${op} Decrypted buffer`, decryptedBuffer);
            return decryptedBuffer;
        } finally {
            release();
        }
    }
}
