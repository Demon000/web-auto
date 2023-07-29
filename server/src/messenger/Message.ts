import { DataBuffer } from '../utils/DataBuffer';

export type MessageOptions =
    | {
          dataPayload?: DataBuffer;
          messageId: number;
      }
    | {
          rawPayload: DataBuffer;
      };

export class Message {
    public messageId: number;
    public payload: DataBuffer;

    public constructor(options: MessageOptions) {
        if ('rawPayload' in options) {
            this.payload = options.rawPayload;
            this.messageId = this.payload.readUint16BE();
        } else {
            this.messageId = options.messageId;
            let size = 2;

            if (options.dataPayload !== undefined) {
                size += options.dataPayload.size;
            }

            this.payload = DataBuffer.fromSize(size);
            this.payload.appendUint16BE(options.messageId);
            if (options.dataPayload !== undefined) {
                this.payload.appendBuffer(options.dataPayload);
            }
        }
    }

    public getPayload(): DataBuffer {
        return this.payload.subarray(2);
    }

    public getBufferPayload(): Buffer {
        return this.getPayload().data;
    }

    public getRawPayload(): DataBuffer {
        return this.payload;
    }
}
