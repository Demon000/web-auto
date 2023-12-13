export enum FrameHeaderFlags {
    NONE = 0,
    FIRST = 1 << 0,
    LAST = 1 << 1,
    CONTROL = 1 << 2,
    ENCRYPTED = 1 << 3,
}

export type FrameHeader = {
    serviceId: number;
    flags: FrameHeaderFlags;
    payloadSize: number;
};
