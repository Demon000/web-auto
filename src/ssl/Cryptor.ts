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

    public doHandshake(): void {
        const result = sslDoHandshake(this.ssl);
        if (result) {
            throw new Error(`Failed to do handshake: ${result}`);
        }
    }

    public readHandshakeBuffer(): Buffer {
        const buffer = DataBuffer.fromSize(0);
        this.read(buffer);
        return buffer.data;
    }
    public writeHandshakeBuffer(buffer: Buffer): void {
        this.write(buffer);
    }

    public encrypt(output: DataBuffer, input: Buffer): number {
        let totalTransferredBytes = 0;

        while (totalTransferredBytes < input.length) {
            const currentBuffer = input.subarray(
                totalTransferredBytes,
                input.length,
            );

            const writeSize = sslWrite(
                this.ssl,
                currentBuffer,
                currentBuffer.length,
            );

            if (writeSize <= 0) {
                throw new Error(`Failed to write to SSL: ${writeSize}`);
            }

            totalTransferredBytes += writeSize;
        }

        return this.read(output);
    }

    public decrypt(output: DataBuffer, input: Buffer): number {
        this.write(input);

        const beginOffset = output.size();
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
            output.resize(output.size() + availableBytes);
        }

        return totalReadSize;
    }

    public read(buffer: DataBuffer): number {
        const pendingSize = sslBioCtrlPending(this.rbio);

        const beginOffset = buffer.size();
        buffer.resize(beginOffset + pendingSize);
        let totalTransferredSize = 0;

        while (totalTransferredSize < pendingSize) {
            const currentBuffer = buffer.data.subarray(
                totalTransferredSize + beginOffset,
            );

            const transferredSize = sslBioRead(
                this.rbio,
                currentBuffer,
                currentBuffer.length,
            );

            if (transferredSize <= 0) {
                throw new Error(`Failed to read from BIO: ${transferredSize}`);
            }

            totalTransferredSize += transferredSize;
        }

        return totalTransferredSize;
    }
    public write(buffer: Buffer): void {
        let totalTransferredSize = 0;

        while (totalTransferredSize < buffer.length) {
            const currentBuffer = buffer.subarray(totalTransferredSize);

            const transferredSize = sslBioWrite(
                this.wbio,
                currentBuffer,
                currentBuffer.length,
            );

            if (transferredSize <= 0) {
                throw new Error(`Failed to write BIO: ${transferredSize}`);
            }

            totalTransferredSize += transferredSize;
        }
    }
}
