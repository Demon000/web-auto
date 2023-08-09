import EventEmitter from 'eventemitter3';

import { DataBuffer } from '@/utils/DataBuffer';

import { DataSink } from './DataSink';
import { TransportEvents } from './ITransport';

export abstract class Transport {
    public emitter = new EventEmitter<TransportEvents>();
    private dataSink = new DataSink();

    public constructor(private chunkSize: number) {}

    protected abstract receiveImpl(buffer: DataBuffer): Promise<number>;
    protected abstract sendImpl(buffer: DataBuffer): Promise<number>;

    public async receive(size: number): Promise<DataBuffer> {
        while (true) {
            const availableSize = this.dataSink.getAvailableSize();

            if (availableSize >= size) {
                break;
            }

            const buffer = this.dataSink.reserve(this.chunkSize);
            const receivedSize = await this.receiveImpl(buffer);
            this.dataSink.commit(receivedSize);
        }

        return this.dataSink.consume(size);
    }

    public async send(buffer: DataBuffer): Promise<void> {
        await this.sendImpl(buffer);
    }
}
