import { bit, mask } from '../utils/bits';

export enum FrameType {
    FIRST = bit(0),
    LAST = bit(1),
    BULK = FIRST | LAST,
    MASK = mask(1, 0),
}
