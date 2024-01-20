import { type FrameHeader, FrameHeaderFlags } from './FrameHeader.js';
import { getLogger } from '@web-auto/logging';
import assert from 'node:assert';
import { type FrameData } from './FrameData.js';
import { BufferReader, BufferWriter } from '../utils/buffer.js';

interface AggregatorData {
    frameHeader: FrameHeader;
    payloads: Uint8Array[];
}

const MAX_FRAME_PAYLOAD_SIZE = 0x4000;

export class MessageAggregator {
    private logger = getLogger(this.constructor.name);
    private serviceIdAggregatorMap = new Map<number, AggregatorData>();

    public aggregate(frameData: FrameData): Uint8Array | undefined {
        this.logger.debug('Aggregate frame data', frameData);

        const frameHeader = frameData.frameHeader;
        const payload = frameData.payload;
        const totalSize = frameData.totalSize;

        if (
            frameHeader.flags & FrameHeaderFlags.FIRST &&
            frameHeader.flags & FrameHeaderFlags.LAST
        ) {
            this.logger.debug('Atomic message', payload);
            return payload;
        } else if (frameHeader.flags & FrameHeaderFlags.FIRST) {
            assert(!this.serviceIdAggregatorMap.has(frameHeader.serviceId));

            const data = {
                frameHeader,
                payloads: [payload],
            };

            this.logger.debug('Creating new aggregated data', data);

            this.serviceIdAggregatorMap.set(frameHeader.serviceId, data);
        } else {
            const data = this.serviceIdAggregatorMap.get(frameHeader.serviceId);
            assert(data !== undefined);

            data.payloads.push(payload);
            this.logger.debug('Adding frame data to aggregated data', {
                frameData,
                aggregatedData: data,
            });

            if (frameHeader.flags & FrameHeaderFlags.LAST) {
                const totalPayload = BufferWriter.concatMultiple(data.payloads);

                if (totalSize !== 0 && totalSize !== totalPayload.byteLength) {
                    this.logger.error(
                        `Received compound message for service ${frameHeader.serviceId} ` +
                            `but size ${totalPayload.byteLength} does not ` +
                            `match total size ${totalSize}`,
                    );
                }

                this.serviceIdAggregatorMap.delete(frameHeader.serviceId);

                this.logger.debug('Aggregated message', totalPayload);

                return totalPayload;
            }
        }

        return undefined;
    }

    private splitOne(
        serviceId: number,
        reader: BufferReader,
        isEncrypted: boolean,
        isControl: boolean,
    ): FrameData {
        const offset = reader.getReadOffset();
        let size = reader.readBufferSize();
        if (size > MAX_FRAME_PAYLOAD_SIZE) {
            size = MAX_FRAME_PAYLOAD_SIZE;
        }
        const payload = reader.readBuffer(size);

        let flags = FrameHeaderFlags.NONE;
        if (isEncrypted) {
            flags |= FrameHeaderFlags.ENCRYPTED;
        }
        if (isControl) {
            flags |= FrameHeaderFlags.CONTROL;
        }
        if (offset === 0) {
            flags |= FrameHeaderFlags.FIRST;
        }
        if (reader.readBufferSize() === 0) {
            flags |= FrameHeaderFlags.LAST;
        }

        const frameHeader = {
            serviceId,
            flags,
            payloadSize: 0,
        };

        let totalSize = 0;
        if (
            flags & FrameHeaderFlags.FIRST &&
            !(flags & FrameHeaderFlags.LAST)
        ) {
            totalSize = reader.totalBufferSize();
        }

        return {
            frameHeader,
            payload,
            totalSize,
        };
    }

    public split(
        serviceId: number,
        totalPayload: Uint8Array,
        isEncrypted: boolean,
        isControl: boolean,
    ): FrameData[] {
        this.logger.debug('Split message', {
            totalPayload,
        });

        const reader = BufferReader.fromBuffer(totalPayload);
        const frameDatas: FrameData[] = [];

        while (reader.readBufferSize() !== 0) {
            const frameData = this.splitOne(
                serviceId,
                reader,
                isEncrypted,
                isControl,
            );
            this.logger.debug('Split frame', frameData);
            frameDatas.push(frameData);
        }

        return frameDatas;
    }
}
