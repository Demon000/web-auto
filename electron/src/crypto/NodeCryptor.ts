import { Cryptor, DataBuffer } from '@web-auto/android-auto';
import DuplexPair from 'native-duplexpair';
import { Readable, Writable } from 'node:stream';
import { connect } from 'node:tls';
import { Mutex } from 'async-mutex';

export class NodeCryptor extends Cryptor {
    private connected = false;
    private cleartext;
    private encrypted;

    private duplexPair: DuplexPair;
    private operationCount = 0;
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
            console.log(`connected, cipher: ${cipher.name} ${cipher.version}`);
            this.connected = true;
        });
    }

    public init(): void {}
    public deinit(): void {}

    public doHandshake(): boolean {
        return this.connected;
    }

    public async readHandshakeBuffer(): Promise<DataBuffer> {
        const count = this.operationCount++;
        console.log();
        const buffer = await this.read(this.encrypted, count);
        console.log(count, 'read handshake buffer', buffer);
        return buffer;
    }

    public async writeHandshakeBuffer(buffer: DataBuffer): Promise<void> {
        const count = this.operationCount++;
        console.log();
        console.log(count, 'write handshake buffer', buffer);
        await this.write(this.encrypted, buffer, count);
    }

    private readSync(readable: Readable, count: number): DataBuffer {
        const buffer = DataBuffer.empty();
        let chunk;
        while (null !== (chunk = readable.read())) {
            console.log(count, 'read chunk', chunk);
            const chunkBuffer = DataBuffer.fromBuffer(chunk);
            buffer.appendBuffer(chunkBuffer);
        }
        return buffer;
    }

    private async read(readable: Readable, count: number): Promise<DataBuffer> {
        return new Promise((resolve, reject) => {
            const buffer = this.readSync(readable, count);
            if (buffer.size) {
                console.log(count, 'read immediately', buffer);
                resolve(buffer);
            } else {
                console.log(count, 'read later');
                readable.once('readable', () => {
                    const buffer = this.readSync(readable, count);
                    console.log(count, 'finished read later', buffer);
                    if (buffer.size) {
                        resolve(buffer);
                    } else {
                        console.log(count, 'read failed');
                        reject(buffer);
                    }
                });
            }
        });
    }

    private async write(
        writeable: Writable,
        buffer: DataBuffer,
        count: number,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(count, 'starting write');
            writeable.write(buffer.data, (err) => {
                console.log(count, 'finished write');
                if (err !== undefined && err !== null) {
                    console.log(count, 'error write');
                    return reject(err);
                }

                resolve();
            });
        });
    }

    public async encrypt(buffer: DataBuffer): Promise<DataBuffer> {
        const count = this.operationCount++;
        console.log();
        console.log(count, 'schedule encrypt', buffer);

        const release = await this.encryptMutex.acquire();
        try {
            console.log(count, 'encrypt', buffer);
            await this.write(this.cleartext, buffer, count);
            return this.read(this.encrypted, count);
        } finally {
            release();
        }
    }

    public async decrypt(buffer: DataBuffer): Promise<DataBuffer> {
        const count = this.operationCount++;
        console.log();
        console.log(count, 'schedule decrypt', buffer);

        const release = await this.decryptMutex.acquire();
        try {
            console.log(count, 'decrypt', buffer);
            await this.write(this.encrypted, buffer, count);
            return this.read(this.cleartext, count);
        } finally {
            release();
        }
    }
}
