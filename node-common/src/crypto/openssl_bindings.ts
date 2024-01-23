import koffi from 'koffi';

const lib = koffi.load('libssl.so.3');

/* Initialization. */

export const OPENSSL_INIT_SETTINGS = koffi.opaque('OPENSSL_INIT_SETTINGS');

export const OPENSSL_init_ssl = lib.func(
    'int OPENSSL_init_ssl(uint64_t opts, const OPENSSL_INIT_SETTINGS *settings)',
);

export const SSL_library_init = () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return OPENSSL_init_ssl(0, 0);
};

export const OPENSSL_INIT_LOAD_SSL_STRINGS = 0x00200000;
export const OPENSSL_INIT_LOAD_CRYPTO_STRINGS = 0x00000002;

export const OPENSSL_INIT_ADD_ALL_CIPHERS = 0x00000004;
export const OPENSSL_INIT_ADD_ALL_DIGESTS = 0x00000008;

export const SSL_load_error_strings = () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return OPENSSL_init_ssl(
        OPENSSL_INIT_LOAD_SSL_STRINGS | OPENSSL_INIT_LOAD_CRYPTO_STRINGS,
        0,
    );
};

export const OPENSSL_init_crypto = lib.func(
    'int OPENSSL_init_crypto(uint64_t opts, const OPENSSL_INIT_SETTINGS *settings)',
);

export const OPENSSL_add_all_algorithms_noconf = () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return OPENSSL_init_crypto(
        OPENSSL_INIT_ADD_ALL_CIPHERS | OPENSSL_INIT_ADD_ALL_DIGESTS,
        0,
    );
};

export const OpenSSL_add_all_algorithms = () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return OPENSSL_add_all_algorithms_noconf();
};

/* BIO. */

export const BIO = koffi.opaque('BIO');

export const BIO_new_mem_buf = lib.func(
    'BIO *BIO_new_mem_buf(const void *buf, int len)',
);

export const BIO_free = lib.func('int BIO_free(BIO *a)');

export const BIO_METHOD = koffi.opaque('BIO_METHOD');

export const BIO_new = lib.func('BIO *BIO_new(const BIO_METHOD *type)');

export const BIO_read = lib.func('int BIO_read(BIO *b, void *data, int dlen)');
export const BIO_write = lib.func(
    'int BIO_write(BIO *b, const void *data, int dlen)',
);

export const BIO_s_mem = lib.func('const BIO_METHOD *BIO_s_mem()');

export const BIO_ctrl_pending = lib.func('size_t BIO_ctrl_pending(BIO *b)');

export const BIO_ctrl = lib.func(
    'long BIO_ctrl(BIO *bp, int cmd, long larg, void *parg)',
);

export const BIO_C_SET_WRITE_BUF_SIZE = 136;

export const BIO_set_write_buf_size = (bio: any, size: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return BIO_ctrl(bio, BIO_C_SET_WRITE_BUF_SIZE, size, 0);
};

/* SSL. */

export const SSL_CTX = koffi.opaque('SSL_CTX');
export const SSL = koffi.opaque('SSL');

export const pem_password_cb = koffi.opaque('pem_password_cb');

export const X509 = koffi.opaque('X509');

export const PEM_read_bio_X509_AUX = lib.func(
    'X509 *PEM_read_bio_X509_AUX(BIO *out, X509 **x, pem_password_cb *cb, void *u)',
);

export const X509_free = lib.func('void X509_free(X509 *a)');

export const SSL_CTX_use_certificate = lib.func(
    'int SSL_CTX_use_certificate(SSL_CTX *ctx, X509 *x)',
);

export const EVP_PKEY = koffi.opaque('EVP_PKEY');

export const PEM_read_bio_PrivateKey = lib.func(
    'EVP_PKEY *PEM_read_bio_PrivateKey(BIO *out, EVP_PKEY **x, pem_password_cb *cb, void *u)',
);

export const EVP_PKEY_free = lib.func('void EVP_PKEY_free(EVP_PKEY *pkey)');

export const SSL_CTX_use_PrivateKey = lib.func(
    'int SSL_CTX_use_PrivateKey(SSL_CTX *ctx, EVP_PKEY *pkey)',
);

export const SSL_METHOD = koffi.opaque('SSL_METHOD');

export const TLS_client_method = lib.func(
    'const SSL_METHOD *TLS_client_method(void)',
);

export const SSL_CTX_new = lib.func(
    'SSL_CTX *SSL_CTX_new(const SSL_METHOD *meth)',
);
export const SSL_CTX_free = lib.func('void SSL_CTX_free(SSL_CTX *)');

export const SSL_new = lib.func('SSL *SSL_new(SSL_CTX *ctx)');
export const SSL_free = lib.func('void SSL_free(SSL *ssl)');

export const SSL_check_private_key = lib.func(
    'int SSL_check_private_key(const SSL *ctx)',
);

export const SSL_set_bio = lib.func(
    'void SSL_set_bio(SSL *s, BIO *rbio, BIO *wbio)',
);

export const SSL_set_connect_state = lib.func(
    'void SSL_set_connect_state(SSL *s)',
);

export const SSL_verify_cb = koffi.opaque('SSL_verify_cb');

export const SSL_VERIFY_NONE = 0x00;

export const SSL_set_verify = lib.func(
    /* Added * to the callback. */
    'void SSL_set_verify(SSL *s, int mode, SSL_verify_cb *callback)',
);

export const SSL_ERROR_WANT_READ = 2;
export const SSL_ERROR_NONE = 0;

export const SSL_do_handshake = lib.func('int SSL_do_handshake(SSL *s)');

export const SSL_get_error = lib.func(
    'int SSL_get_error(const SSL *s, int ret_code)',
);

export const SSL_pending = lib.func('int SSL_pending(const SSL *s)');
export const SSL_read = lib.func('int SSL_read(SSL *ssl, void *buf, int num)');
export const SSL_write = lib.func(
    'int SSL_write(SSL *ssl, const void *buf, int num)',
);
