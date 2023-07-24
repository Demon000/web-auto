export class MessageId {
    public constructor(public readonly id: number) {}

    public static fromBuffer(buffer: Buffer): MessageId {
        const id = buffer.readUint16BE();
        return new MessageId(id);
    }

    public toBuffer(): Buffer {
        const buffer = Buffer.allocUnsafe(this.getSizeOf());
        buffer.writeUint16BE(this.id);
        return buffer;
    }

    public getSizeOf(): number {
        return 2;
    }
}
