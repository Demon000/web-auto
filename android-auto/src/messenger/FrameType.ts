import { bit } from '@/utils/bits';

export enum FrameType {
    FIRST = bit(0),
    LAST = bit(1),
    ATOMIC = FIRST | LAST,
}
