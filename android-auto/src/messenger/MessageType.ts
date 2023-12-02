import { bit } from '../utils/bits.js';

export enum MessageType {
    SPECIFIC = 0,
    CONTROL = bit(2),
}
