import { Cryptor, DataBuffer } from '@web-auto/android-auto';
import DuplexPair from 'native-duplexpair';
import { Readable, Writable } from 'node:stream';
import { connect } from 'node:tls';
import { Mutex } from 'async-mutex';
import { getLogger } from '@web-auto/logging';

export class NodeCryptor extends Cryptor {
    private logger = getLogger(this.constructor.name);

    private connected = false;
    private cleartext;
    private encrypted;

    private duplexPair: DuplexPair;
    private encryptMutex = new Mutex();
    private decryptMutex = new Mutex();

    public constructor(
        protected certificateBuffer: Buffer,
        protected privateKeyBuffer: Buffer,
    ) {
        super(certificateBuffer, privateKeyBuffer);

        this.duplexPair = new DuplexPair();
        this.cleartext = connect({
            socket: this.duplexPair.socket1,
            key: this.privateKeyBuffer,
            cert: this.certificateBuffer,
            rejectUnauthorized: false,
            enableTrace: true,
        });
        this.encrypted = this.duplexPair.socket2;

        this.cleartext.once('secureConnect', () => {
            const cipher = this.cleartext.getCipher();
            this.logger.debug(
                `Connected, cipher: ${cipher.name} ${cipher.version}`,
            );
            this.connected = true;
        });
    }

    public init(): void {}
    public deinit(): void {}

    public doHandshake(): boolean {
        return this.connected;
    }

    public async readHandshakeBuffer(): Promise<DataBuffer> {
        return await this.read(this.encrypted);
    }

    public async writeHandshakeBuffer(buffer: DataBuffer): Promise<void> {
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
            writeable.write(buffer.data, (err) => {
                if (err !== undefined && err !== null) {
                    return reject(err);
                }

                resolve();
            });
        });
    }

    public async encrypt(buffer: DataBuffer): Promise<DataBuffer> {
        const release = await this.encryptMutex.acquire();
        try {
            await this.write(this.cleartext, buffer);
            return this.read(this.encrypted);
        } finally {
            release();
        }
    }

    public async decrypt(buffer: DataBuffer): Promise<DataBuffer> {
        const release = await this.decryptMutex.acquire();
        try {
            await this.write(this.encrypted, buffer);
            return this.read(this.cleartext);
        } finally {
            release();
        }
    }
}
