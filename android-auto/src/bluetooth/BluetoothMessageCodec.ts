import { DataBuffer } from '@/utils/DataBuffer';
import { getLogger } from '@web-auto/logging';
import { BluetoothMessage } from './BluetoothMessage';

export class BluetoothMessageCodec {
    protected logger = getLogger(this.constructor.name);

    public encodeMessage(message: BluetoothMessage): DataBuffer {
        const buffer = DataBuffer.empty();

        buffer.appendUint16BE(message.payload.size);
        buffer.appendUint16BE(message.type);
        buffer.appendBuffer(message.payload);

        return buffer;
    }

    public decodeMessage(buffer: DataBuffer): BluetoothMessage {
        const size = buffer.readUint16BE();
        const type = buffer.readUint16BE();
        const payload = buffer.readBuffer(size);
        return new BluetoothMessage(type, payload);
    }

    public decodeBuffer(data: Buffer): BluetoothMessage[] {
        this.logger.debug('Receive data', {
            metadata: data,
        });

        const buffer = DataBuffer.fromBuffer(data);

        const messages = [];
        while (buffer.readBufferSize() !== 0) {
            const message = this.decodeMessage(buffer);
            messages.push(message);
        }
        return messages;
    }
}
