import { Message as ProtoMessage } from '@bufbuild/protobuf';

import { BufferReader } from '../utils/BufferReader.js';
import { BufferWriter } from '../utils/BufferWriter.js';

export class MessageCodec {
    public encodeMessage(messageId: number, message: ProtoMessage): Uint8Array {
        const payload = message.toBinary();
        return this.encodePayload(messageId, payload);
    }

    public encodePayload(messageId: number, payload: Uint8Array): Uint8Array {
        const writer = BufferWriter.fromSize(2 + payload.byteLength);
        writer.appendUint16BE(messageId);
        writer.appendBuffer(payload);
        return writer.data;
    }

    public decodeMessage(totalPayload: Uint8Array): [number, Uint8Array] {
        const reader = BufferReader.fromBuffer(totalPayload);
        const messageId = reader.readUint16BE();
        const payload = reader.readBuffer();
        return [messageId, payload];
    }
}
