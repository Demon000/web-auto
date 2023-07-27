import { bit } from '../utils/bits';

export enum EncryptionType {
    PLAIN = 0,
    ENCRYPTED = bit(3),
}
