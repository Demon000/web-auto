import { bit } from '../utils/bits.js';

export enum EncryptionType {
    PLAIN = 0,
    ENCRYPTED = bit(3),
}
