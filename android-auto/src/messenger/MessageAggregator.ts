import { DataBuffer } from '../utils/DataBuffer.js';
import { type FrameHeader, FrameHeaderFlags } from './FrameHeader.js';
import { getLogger } from '@web-auto/logging';
import { Message } from './Message.js';
import assert from 'node:assert';
import { type FrameData } from './FrameData.js';

interface AggregatorData {
    frameHeader: FrameHeader;
    payload: DataBuffer;
}

interface SplitMessageContext {
    remainingSize: number;
}

const MAX_FRAME_PAYLOAD_SIZE = 0x4000;

export class MessageAggregator {
    private logger = getLogger(this.constructor.name);
    private serviceIdAggregatorMap = new Map<number, AggregatorData>();

    public aggregate(frameData: FrameData): Message | undefined {
        this.logger.debug('Aggregate frame data', frameData);
        const frameHeader = frameData.frameHeader;
        const payload = frameData.payload;
        const totalSize = frameData.totalSize;

        if (
            frameHeader.flags & FrameHeaderFlags.FIRST &&
            frameHeader.flags & FrameHeaderFlags.LAST
        ) {
            const message = new Message({
                rawPayload: payload,
            });
            this.logger.debug('Atomic message', message);
            return message;
        } else if (frameHeader.flags & FrameHeaderFlags.FIRST) {
            assert(!this.serviceIdAggregatorMap.has(frameHeader.serviceId));

            const data = {
                frameHeader,
                payload,
            };

            this.logger.debug('Creating new aggregated data', data);

            this.serviceIdAggregatorMap.set(frameHeader.serviceId, data);
        } else {
            const data = this.serviceIdAggregatorMap.get(frameHeader.serviceId);
            assert(data !== undefined);

            data.payload.appendBuffer(payload);
            this.logger.debug('Adding frame data to aggregated data', {
                frameData,
                aggregatedData: data,
            });

            if (frameHeader.flags & FrameHeaderFlags.LAST) {
                if (totalSize !== 0 && totalSize !== payload.size) {
                    this.logger.error(
                        `Received compound message for service ${frameHeader.serviceId} ` +
                            `but size ${data.payload.size} does not ` +
                            `match total size ${totalSize}`,
                    );
                }

                this.serviceIdAggregatorMap.delete(frameHeader.serviceId);

                const message = new Message({
                    rawPayload: data.payload,
                });
                this.logger.debug('Aggregated message', message);
                return message;
            }
        }

        return undefined;
    }

    private splitOne(
        serviceId: number,
        message: Message,
        isEncrypted: boolean,
        isControl: boolean,
        context: SplitMessageContext,
    ): FrameData {
        const offset = message.payload.size - context.remainingSize;
        let size = context.remainingSize;
        if (size > MAX_FRAME_PAYLOAD_SIZE) {
            size = MAX_FRAME_PAYLOAD_SIZE;
        }
        context.remainingSize -= size;

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
        if (context.remainingSize === 0) {
            flags |= FrameHeaderFlags.LAST;
        }

        const payload = message.getRawPayload().subarray(offset, offset + size);

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
            totalSize = message.getRawPayload().size;
        }

        return {
            frameHeader,
            payload,
            totalSize,
        };
    }

    public split(
        serviceId: number,
        message: Message,
        isEncrypted: boolean,
        isControl: boolean,
    ): FrameData[] {
        this.logger.debug('Split message', {
            message,
            buffer: message.getBufferPayload().toString('hex'),
        });
        const context = {
            remainingSize: message.payload.size,
        };
        const frameDatas: FrameData[] = [];

        while (context.remainingSize !== 0) {
            const frameData = this.splitOne(
                serviceId,
                message,
                isEncrypted,
                isControl,
                context,
            );
            this.logger.debug('Split frame', frameData);
            frameDatas.push(frameData);
        }

        return frameDatas;
    }
}
