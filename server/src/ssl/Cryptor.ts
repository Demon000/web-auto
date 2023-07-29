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
    sslGetMethod,
    sslRead,
    sslReadCertificate,
    sslReadPrivateKey,
    sslSetBIOs,
    sslSetConnectState,
    sslWrite,
} from './ssl';
import { ICryptor } from './ICryptor';
import { DataBuffer } from '../utils/DataBuffer';
import { SSL_ERROR_NONE, SSL_ERROR_WANT_READ } from './openssl_bindings';

export class Cryptor implements ICryptor {
    private maxBufferSize = 1024 * 20;
    private context = null;
    private certificate = null;
    private privateKey = null;
    private rbio = null;
    private wbio = null;
    private ssl = null;

    public constructor(
        private certificateBuffer: Buffer,
        private privateKeyBuffer: Buffer,
    ) {}

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

    public readHandshakeBuffer(): DataBuffer {
        const buffer = DataBuffer.empty();
        this.read(buffer);
        return buffer;
    }
    public writeHandshakeBuffer(buffer: DataBuffer): void {
        this.write(buffer);
    }

    public encrypt(output: DataBuffer, input: DataBuffer): number {
        let totalTransferredBytes = 0;

        while (totalTransferredBytes < input.size) {
            const currentBuffer = input.subarray(
                totalTransferredBytes,
                input.size,
            );

            const writeSize = sslWrite(
                this.ssl,
                currentBuffer.data,
                currentBuffer.size,
            );

            if (writeSize <= 0) {
                throw new Error(`Failed to write to SSL: ${writeSize}`);
            }

            totalTransferredBytes += writeSize;
        }

        return this.read(output);
    }

    public decrypt(output: DataBuffer, input: DataBuffer): number {
        this.write(input);

        const beginOffset = output.size;
        output.resize(beginOffset + 1);

        let availableBytes = 1;
        let totalReadSize = 0;

        while (availableBytes > 0) {
            const currentBuffer = output.data.subarray(
                totalReadSize + beginOffset,
            );

            const transferredSize = sslRead(
                this.ssl,
                currentBuffer,
                currentBuffer.length,
            );

            if (transferredSize <= 0) {
                throw new Error(`Failed to read from SSL: ${transferredSize}`);
            }

            totalReadSize += transferredSize;
            availableBytes = sslGetAvailableBytes(this.ssl);
            output.resize(output.size + availableBytes);
        }

        return totalReadSize;
    }

    public read(buffer: DataBuffer): number {
        const pendingSize = sslBioCtrlPending(this.wbio);

        const beginOffset = buffer.size;
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
                throw new Error(`Failed to read from BIO: ${transferredSize}`);
            }

            totalTransferredSize += transferredSize;
        }

        return totalTransferredSize;
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
                throw new Error(`Failed to write BIO: ${transferredSize}`);
            }

            totalTransferredSize += transferredSize;
        }
    }
}
