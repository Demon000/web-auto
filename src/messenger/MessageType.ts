import { bit } from '../utils/bits';

export enum MessageType {
    SPECIFIC = 0,
    CONTROL = bit(2),
}
