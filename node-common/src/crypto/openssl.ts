import {
    BIO_ctrl_pending,
    BIO_free,
    BIO_new,
    BIO_new_mem_buf,
    BIO_read,
    BIO_s_mem,
    BIO_set_write_buf_size,
    BIO_write,
    EVP_PKEY_free,
    OpenSSL_add_all_algorithms,
    PEM_read_bio_PrivateKey,
    PEM_read_bio_X509_AUX,
    SSL_check_private_key,
    SSL_CTX_free,
    SSL_CTX_new,
    SSL_CTX_use_certificate,
    SSL_CTX_use_PrivateKey,
    SSL_do_handshake,
    SSL_free,
    SSL_get_error,
    SSL_library_init,
    SSL_load_error_strings,
    SSL_new,
    SSL_pending,
    SSL_read,
    SSL_set_bio,
    SSL_set_connect_state,
    SSL_set_verify,
    SSL_VERIFY_NONE,
    SSL_write,
    TLS_client_method,
    X509_free,
} from './openssl_bindings.js';

export function sslInit(): void {
    SSL_library_init();
    SSL_load_error_strings();
    OpenSSL_add_all_algorithms();
}

export function sslReadCertificate(certString: Uint8Array): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const bio = BIO_new_mem_buf(certString, certString.length);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const certificate = PEM_read_bio_X509_AUX(bio, null, null, null);
    BIO_free(bio);
    return certificate;
}

export function sslReadPrivateKey(privateKeyString: Uint8Array): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const bio = BIO_new_mem_buf(privateKeyString, privateKeyString.length);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const privateKey = PEM_read_bio_PrivateKey(bio, null, null, null);
    BIO_free(bio);
    return privateKey;
}

export function sslGetMethod(): any {
    return TLS_client_method();
}

export function sslCreateContext(method: any): any {
    return SSL_CTX_new(method);
}

export function sslCtxUseCertificate(context: any, certificate: any): boolean {
    return SSL_CTX_use_certificate(context, certificate) == 1;
}

export function sslCtxUsePrivateKey(context: any, privateKey: any): boolean {
    return SSL_CTX_use_PrivateKey(context, privateKey) == 1;
}

export function sslCreateInstance(context: any): any {
    return SSL_new(context);
}

export function sslCheckPrivateKey(ssl: any): boolean {
    return SSL_check_private_key(ssl) == 1;
}

export function sslCreateBIO(): any {
    return BIO_new(BIO_s_mem());
}

export function sslFreeBio(bio: any): void {
    BIO_free(bio);
}

export function sslFreeCertificate(certificate: any): void {
    X509_free(certificate);
}

export function sslFreePrivateKey(privateKey: any): void {
    EVP_PKEY_free(privateKey);
}

export function sslBioRead(bio: any, buf: Uint8Array, len: number): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return BIO_read(bio, buf, len);
}

export function sslBioWrite(bio: any, buf: Uint8Array, len: number): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return BIO_write(bio, buf, len);
}

export function sslBioCtrlPending(bio: any): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return BIO_ctrl_pending(bio);
}

export function sslGetAvailableBytes(ssl: any): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return SSL_pending(ssl);
}

export function sslRead(ssl: any, buf: Uint8Array, len: number): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return SSL_read(ssl, buf, len);
}

export function sslWrite(ssl: any, buf: Uint8Array, len: number): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return SSL_write(ssl, buf, len);
}

export function sslGetError(ssl: any, returnCode: number): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return SSL_get_error(ssl, returnCode);
}

export function sslSetBIOs(
    ssl: any,
    rbio: any,
    wbio: any,
    maxBufferSize: number,
): void {
    SSL_set_bio(ssl, rbio, wbio);
    BIO_set_write_buf_size(rbio, maxBufferSize);
    BIO_set_write_buf_size(wbio, maxBufferSize);
}

export function sslSetConnectState(ssl: any): void {
    SSL_set_connect_state(ssl);
    SSL_set_verify(ssl, SSL_VERIFY_NONE, null);
}

export function sslDoHandshake(ssl: any): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = SSL_do_handshake(ssl);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return SSL_get_error(ssl, result);
}

export function sslFreeInstance(ssl: any): void {
    SSL_free(ssl);
}

export function sslFreeContext(context: any): void {
    SSL_CTX_free(context);
}
