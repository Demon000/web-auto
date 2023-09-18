import { DataBuffer } from '@web-auto/android-auto';

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
} from './openssl';
import { Cryptor } from '@web-auto/android-auto';
import { SSL_ERROR_NONE, SSL_ERROR_WANT_READ } from './openssl_bindings';

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

    public init(): void {
        this.certificate = sslReadCertificate(this.certificateBuffer);
        this.privateKey = sslReadPrivateKey(this.privateKeyBuffer);
        this.context = sslCreateContext(sslGetMethod());

        if (!sslCtxUseCertificate(this.context, this.certificate)) {
            throw new Error('Failed to use certificate');
        }
        if (!sslCtxUsePrivateKey(this.context, this.privateKey)) {
            throw new Error('Failed to use private key');
        }
        this.ssl = sslCreateInstance(this.context);
        this.rbio = sslCreateBIO();
        this.wbio = sslCreateBIO();
        sslSetBIOs(this.ssl, this.rbio, this.wbio, this.maxBufferSize);
        sslSetConnectState(this.ssl);
    }

    public deinit(): void {
        sslFreeInstance(this.ssl);
        sslFreeContext(this.context);
        sslFreePrivateKey(this.privateKey);
        sslFreeCertificate(this.certificate);
    }

    public doHandshake(): boolean {
        const result = sslDoHandshake(this.ssl);
        if (result === SSL_ERROR_WANT_READ) {
            return false;
        } else if (result === SSL_ERROR_NONE) {
            return true;
        } else {
            throw new Error(`SSL handshake failed: ${result}`);
        }
    }

    public async readHandshakeBuffer(): Promise<DataBuffer> {
        return this.read();
    }
    public async writeHandshakeBuffer(buffer: DataBuffer): Promise<void> {
        this.write(buffer);
    }

    public async encrypt(buffer: DataBuffer): Promise<DataBuffer> {
        let totalTransferredSize = 0;

        while (totalTransferredSize < buffer.size) {
            const currentBuffer = buffer.subarray(totalTransferredSize);

            const transferredSize = sslWrite(
                this.ssl,
                currentBuffer.data,
                currentBuffer.size,
            );

            if (transferredSize <= 0) {
                const error = sslGetError(this.ssl, transferredSize);
                throw new Error(`Failed to write to SSL: ${error}`);
            }

            totalTransferredSize += transferredSize;
        }

        return this.read();
    }

    public async decrypt(buffer: DataBuffer): Promise<DataBuffer> {
        this.write(buffer);

        const decryptedBuffer = DataBuffer.empty();
        const beginOffset = 0;

        let availableBytes = 1;
        let totalTransferredSize = 0;

        while (availableBytes > 0) {
            decryptedBuffer.resize(decryptedBuffer.size + availableBytes);

            const currentBuffer = decryptedBuffer.subarray(
                totalTransferredSize + beginOffset,
            );

            const transferredSize = sslRead(
                this.ssl,
                currentBuffer.data,
                currentBuffer.size,
            );

            if (transferredSize <= 0) {
                const error = sslGetError(this.ssl, transferredSize);
                throw new Error(`Failed to read from SSL: ${error}`);
            }

            availableBytes = sslGetAvailableBytes(this.ssl);
            totalTransferredSize += transferredSize;
        }

        return decryptedBuffer;
    }

    public read(): DataBuffer {
        const pendingSize = sslBioCtrlPending(this.wbio);

        const buffer = DataBuffer.empty();
        const beginOffset = 0;
        buffer.resize(beginOffset + pendingSize);
        let totalTransferredSize = 0;

        while (totalTransferredSize < pendingSize) {
            const currentBuffer = buffer.subarray(
                totalTransferredSize + beginOffset,
            );

            const transferredSize = sslBioRead(
                this.wbio,
                currentBuffer.data,
                currentBuffer.size,
            );

            if (transferredSize <= 0) {
                const error = sslGetError(this.ssl, transferredSize);
                throw new Error(`Failed to read from BIO: ${error}`);
            }

            totalTransferredSize += transferredSize;
        }

        return buffer;
    }

    public write(buffer: DataBuffer): void {
        let totalTransferredSize = 0;

        while (totalTransferredSize < buffer.size) {
            const currentBuffer = buffer.subarray(totalTransferredSize);

            const transferredSize = sslBioWrite(
                this.rbio,
                currentBuffer.data,
                currentBuffer.size,
            );

            if (transferredSize <= 0) {
                const error = sslGetError(this.ssl, transferredSize);
                throw new Error(`Failed to write BIO: ${error}`);
            }

            totalTransferredSize += transferredSize;
        }
    }
}
