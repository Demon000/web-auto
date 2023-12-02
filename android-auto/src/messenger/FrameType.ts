import { bit } from '../utils/bits.js';

export enum FrameType {
    FIRST = bit(0),
    MIDDLE = 0,
    LAST = bit(1),
    ATOMIC = FIRST | LAST,
}
