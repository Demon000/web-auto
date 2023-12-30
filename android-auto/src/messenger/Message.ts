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

    public getPayload(): Uint8Array {
        return this.payload.subarray(2);
    }

    public getBufferPayload(): Uint8Array {
        return this.getPayload().data;
    }

    public getRawPayload(): Uint8Array {
        return this.payload;
    }
}
