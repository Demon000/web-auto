import { DataBuffer } from '@/utils/DataBuffer';
import { MessageType } from './MessageType';
import { ChannelId } from '.';

export type MessageOptions =
    | {
          dataPayload?: DataBuffer;
          channelId: ChannelId;
          messageType: MessageType;
          messageId: number;
      }
    | {
          rawPayload: DataBuffer;
          channelId: ChannelId;
          messageType: MessageType;
      };

export class Message {
    public messageType: MessageType;
    public channelId: ChannelId;
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
        this.messageType = options.messageType;
        this.channelId = options.channelId;
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
