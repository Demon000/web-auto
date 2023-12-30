import { BufferWriter, BufferReader } from '../utils/buffer.js';

export type MessageOptions =
    | {
          dataPayload?: Uint8Array;
          messageId: number;
      }
    | {
          rawPayload: Uint8Array;
      };

export class Message {
    public messageId: number;
    public payload: Uint8Array;

    public constructor(options: MessageOptions) {
        if ('rawPayload' in options) {
            this.payload = options.rawPayload;
            const reader = BufferReader.fromBuffer(options.rawPayload);
            this.messageId = reader.readUint16BE();
        } else {
            this.messageId = options.messageId;
            let size = 2;

            if (options.dataPayload !== undefined) {
                size += options.dataPayload.byteLength;
            }

            const writer = BufferWriter.fromSize(size);
            writer.appendUint16BE(options.messageId);
            if (options.dataPayload !== undefined) {
                writer.appendBuffer(options.dataPayload);
            }
            this.payload = writer.data;
        }
    }

    public getPayload(): Uint8Array {
        return this.payload.subarray(2);
    }

    public getBufferPayload(): Uint8Array {
        return this.getPayload();
    }

    public getRawPayload(): Uint8Array {
        return this.payload;
    }
}
