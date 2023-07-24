export enum FrameType {
    MIDDLE = 0,
    FIRST = 1 << 0,
    LAST = 1 << 1,
    BULK = FIRST | LAST,
}
