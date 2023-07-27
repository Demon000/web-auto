import { DataBuffer } from '../utils/DataBuffer';

export type MessageOptions = {
    payload?: DataBuffer;
    messageId?: number;
};

export class Message {
    public readonly payload: DataBuffer;
    public messageId?: number;

    public constructor(options?: MessageOptions) {
        if (options === undefined) {
            options = {};
        }

        this.messageId = options.messageId;

        if (options.payload !== undefined && options.messageId === undefined) {
            this.payload = options.payload;
        } else {
            let size = 0;

            if (options.messageId !== undefined) {
                size += 2;
            }
            if (options.payload !== undefined) {
                size += options.payload.size;
            }

            this.payload = DataBuffer.fromSize(size);

            if (options.messageId !== undefined) {
                this.payload.appendUint16BE(options.messageId);
            }

            if (options.payload !== undefined) {
                this.payload.appendBuffer(options.payload);
            }
        }
    }

    public appendBuffer(buffer: Buffer): void {
        if (this.payload.size === 0 && this.messageId === undefined) {
            const messageIdSize = 2;
            if (buffer.length < messageIdSize) {
                throw new Error('Buffer size too small to retrieve message id');
            }

            this.messageId = buffer.readUint16BE();
            buffer = buffer.subarray(messageIdSize);
        }

        this.payload.appendBuffer(buffer);
    }
}
