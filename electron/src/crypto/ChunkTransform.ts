import { DataBuffer } from '@web-auto/android-auto';
import type { LoggerWrapper } from '@web-auto/logging';
import assert from 'node:assert';
import { Transform, type TransformCallback } from 'node:stream';

export class ChunkTransform extends Transform {
    private queue: number[] = [];
    private buffer = DataBuffer.fromSize(0);

    public constructor(private logger?: LoggerWrapper) {
        super({
            objectMode: true,
        });
    }

    public _transform(
        chunk: Buffer | string,
        _encoding: BufferEncoding,
        callback: TransformCallback,
    ): void {
        assert(chunk instanceof Buffer);

        if (this.logger !== undefined) {
            this.logger.error(
                `Transforming chunk with length ${chunk.length}`,
                chunk,
            );
        }

        const buffer = DataBuffer.fromBuffer(chunk);
        this.buffer.appendBuffer(buffer);

        while (this.queue.length !== 0) {
            const size = this.queue[0];

            if (this.logger !== undefined) {
                this.logger.error(`Found size ${size}`);
            }

            if (size > this.buffer.readBufferSize()) {
                break;
            }

            const slice = this.buffer.readBuffer(size);

            this.push(slice.data);

            this.queue.shift();
        }

        this.buffer = this.buffer.readBuffer();

        if (this.logger !== undefined) {
            this.logger.error(`Leftover size ${this.buffer.size}`);
        }

        callback();
    }

    public addSize(size: number): void {
        this.queue.push(size);
    }
}
