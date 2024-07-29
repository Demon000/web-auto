import { getLogger } from '@web-auto/logging';

import { BufferReader, BufferWriter } from '../utils/buffer.js';
import { BluetoothMessage } from './BluetoothMessage.js';

export class BluetoothMessageCodec {
    protected logger = getLogger(this.constructor.name);

    public encodeMessage(message: BluetoothMessage): Uint8Array {
        const buffer = BufferWriter.fromSize(
            2 + 2 + message.payload.byteLength,
        );

        buffer.appendUint16BE(message.payload.byteLength);
        buffer.appendUint16BE(message.type);
        buffer.appendBuffer(message.payload);

        return buffer.data;
    }

    public decodeMessage(buffer: BufferReader): BluetoothMessage {
        const size = buffer.readUint16BE();
        const type = buffer.readUint16BE();
        const payload = buffer.readBuffer(size);
        return new BluetoothMessage(type, payload);
    }

    public decodeBuffer(data: Uint8Array): BluetoothMessage[] {
        const buffer = BufferReader.fromBuffer(data);

        const messages = [];
        while (buffer.readBufferSize() !== 0) {
            const message = this.decodeMessage(buffer);
            messages.push(message);
        }
        return messages;
    }
}
