export enum FrameHeaderFlags {
    NONE = 0,
    FIRST = 1 << 0,
    LAST = 1 << 1,
    CONTROL = 1 << 2,
    ENCRYPTED = 1 << 3,
}

export type FrameHeaderOptions = {
    serviceId: number;
    flags: FrameHeaderFlags;
    payloadSize: number;
};

export class FrameHeader {
    public readonly serviceId;
    public readonly flags;
    public payloadSize;

    public constructor(options: FrameHeaderOptions) {
        this.serviceId = options.serviceId;
        this.flags = options.flags;
        this.payloadSize = options.payloadSize;
    }
}
