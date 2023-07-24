export class Timestamp {
    public constructor(public readonly stamp: bigint) {}

    public static fromBuffer(buffer: Buffer) {
        const stamp = buffer.readBigUInt64BE(0);
        return new Timestamp(stamp);
    }

    public toBuffer(): Buffer {
        const buffer = Buffer.allocUnsafe(this.getSizeOf());
        buffer.writeBigUInt64BE(this.stamp);
        return buffer;
    }

    public getSizeOf(): number {
        return 8;
    }
}
