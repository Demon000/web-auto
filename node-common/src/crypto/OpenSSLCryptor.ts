import { BufferWriter, Cryptor } from '@web-auto/android-auto';

import {
    sslBioCtrlPending,
    sslBioRead,
    sslBioWrite,
    sslCreateBIO,
    sslCreateContext,
    sslCreateInstance,
    sslCtxUseCertificate,
    sslCtxUsePrivateKey,
    sslDoHandshake,
    sslFreeCertificate,
    sslFreeContext,
    sslFreeInstance,
    sslFreePrivateKey,
    sslGetAvailableBytes,
    sslGetError,
    sslGetMethod,
    sslRead,
    sslReadCertificate,
    sslReadPrivateKey,
    sslSetBIOs,
    sslSetConnectState,
    sslWrite,
} from './openssl.js';
import { SSL_ERROR_NONE, SSL_ERROR_WANT_READ } from './openssl_bindings.js';

export class OpenSSLCryptor extends Cryptor {
    private maxBufferSize = 1024 * 20;
    private context = null;
    private certificate = null;
    private privateKey = null;
    private rbio = null;
    private wbio = null;
    private ssl = null;

    public constructor(certificateBuffer: Buffer, privateKeyBuffer: Buffer) {
        super(certificateBuffer, privateKeyBuffer);
    }

    public start(): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.certificate = sslReadCertificate(this.certificateBuffer);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.privateKey = sslReadPrivateKey(this.privateKeyBuffer);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.context = sslCreateContext(sslGetMethod());

        if (!sslCtxUseCertificate(this.context, this.certificate)) {
            throw new Error('Failed to use certificate');
        }
        if (!sslCtxUsePrivateKey(this.context, this.privateKey)) {
            throw new Error('Failed to use private key');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.ssl = sslCreateInstance(this.context);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.rbio = sslCreateBIO();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.wbio = sslCreateBIO();
        sslSetBIOs(this.ssl, this.rbio, this.wbio, this.maxBufferSize);
        sslSetConnectState(this.ssl);
    }

    public stop(): void {
        sslFreeInstance(this.ssl);
        sslFreeContext(this.context);
        sslFreePrivateKey(this.privateKey);
        sslFreeCertificate(this.certificate);
    }

    public isHandshakeComplete(): boolean {
        const result = sslDoHandshake(this.ssl);
        if (result === SSL_ERROR_WANT_READ) {
            return false;
        } else if (result === SSL_ERROR_NONE) {
            return true;
        } else {
            throw new Error(`SSL handshake failed: ${result}`);
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async readHandshakeBuffer(): Promise<Uint8Array> {
        return this.read();
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    public async writeHandshakeBuffer(buffer: Uint8Array): Promise<void> {
        this.write(buffer);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async encrypt(buffer: Uint8Array): Promise<Uint8Array> {
        let totalTransferredSize = 0;

        while (totalTransferredSize < buffer.byteLength) {
            const currentBuffer = buffer.subarray(totalTransferredSize);

            const transferredSize = sslWrite(
                this.ssl,
                currentBuffer,
                currentBuffer.byteLength,
            );

            if (transferredSize <= 0) {
                const error = sslGetError(this.ssl, transferredSize);
                throw new Error(`Failed to write to SSL: ${error}`);
            }

            totalTransferredSize += transferredSize;
        }

        return this.read();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async decrypt(buffer: Uint8Array): Promise<Uint8Array> {
        this.write(buffer);

        const buffers = [];

        let availableBytes = 1;

        while (availableBytes > 0) {
            const currentBuffer = new Uint8Array(availableBytes);

            const transferredSize = sslRead(
                this.ssl,
                currentBuffer,
                availableBytes,
            );

            if (transferredSize <= 0) {
                const error = sslGetError(this.ssl, transferredSize);
                throw new Error(`Failed to read from SSL: ${error}`);
            }

            availableBytes = sslGetAvailableBytes(this.ssl);
            buffers.push(currentBuffer);
        }

        return BufferWriter.concatMultiple(buffers);
    }

    public read(): Uint8Array {
        const pendingSize = sslBioCtrlPending(this.wbio);

        const buffer = new Uint8Array(pendingSize);
        let totalTransferredSize = 0;

        while (totalTransferredSize < pendingSize) {
            const currentBuffer = buffer.subarray(totalTransferredSize);

            const transferredSize = sslBioRead(
                this.wbio,
                currentBuffer,
                currentBuffer.byteLength,
            );

            if (transferredSize <= 0) {
                const error = sslGetError(this.ssl, transferredSize);
                throw new Error(`Failed to read from BIO: ${error}`);
            }

            totalTransferredSize += transferredSize;
        }

        return buffer;
    }

    public write(buffer: Uint8Array): void {
        let totalTransferredSize = 0;

        while (totalTransferredSize < buffer.byteLength) {
            const currentBuffer = buffer.subarray(totalTransferredSize);

            const transferredSize = sslBioWrite(
                this.rbio,
                currentBuffer,
                currentBuffer.byteLength,
            );

            if (transferredSize <= 0) {
                const error = sslGetError(this.ssl, transferredSize);
                throw new Error(`Failed to write BIO: ${error}`);
            }

            totalTransferredSize += transferredSize;
        }
    }
}
