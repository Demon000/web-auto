import { DataBuffer } from '@/utils/DataBuffer';
import { FrameHeader } from './FrameHeader';
import { getLogger } from '@web-auto/logging';
import { Message } from './Message';
import { FrameType } from './FrameType';
import assert from 'node:assert';
import { EncryptionType } from './EncryptionType';
import { FrameData } from './FrameData';

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
        this.logger.debug('Aggregate frame data', {
            metadata: frameData,
        });
        const frameHeader = frameData.frameHeader;
        const payload = frameData.payload;
        const totalSize = frameData.totalSize;

        if (frameHeader.frameType === FrameType.ATOMIC) {
            const message = new Message({
                rawPayload: payload,
                serviceId: frameHeader.serviceId,
                messageType: frameHeader.messageType,
            });
            this.logger.debug('Atomic message', {
                metadata: message,
            });
            return message;
        } else if (frameHeader.frameType === FrameType.FIRST) {
            assert(!this.serviceIdAggregatorMap.has(frameHeader.serviceId));

            const data = {
                frameHeader,
                payload,
            };

            this.logger.debug('Creating new aggregated data', {
                metadata: data,
            });

            this.serviceIdAggregatorMap.set(frameHeader.serviceId, data);
        } else if (
            frameHeader.frameType === FrameType.MIDDLE ||
            frameHeader.frameType === FrameType.LAST
        ) {
            const data = this.serviceIdAggregatorMap.get(frameHeader.serviceId);
            assert(data !== undefined);
            data.payload.appendBuffer(payload);
            this.logger.debug('Adding frame data to aggregated data', {
                metadata: {
                    frameData,
                    aggregatedData: data,
                },
            });

            if (frameHeader.frameType === FrameType.LAST) {
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
                    serviceId: data.frameHeader.serviceId,
                    messageType: data.frameHeader.messageType,
                });
                this.logger.debug('Aggregated message', {
                    metadata: message,
                });
                return message;
            }
        }

        return undefined;
    }

    private splitOne(
        message: Message,
        encryptionType: EncryptionType,
        context: SplitMessageContext,
    ): FrameData {
        const offset = message.payload.size - context.remainingSize;
        let size = context.remainingSize;
        if (size > MAX_FRAME_PAYLOAD_SIZE) {
            size = MAX_FRAME_PAYLOAD_SIZE;
        }
        context.remainingSize -= size;

        let frameType = 0;
        if (offset === 0) {
            frameType |= FrameType.FIRST;
        }
        if (context.remainingSize === 0) {
            frameType |= FrameType.LAST;
        }

        const payload = message.getRawPayload().subarray(offset, offset + size);

        const frameHeader = new FrameHeader({
            serviceId: message.serviceId,
            encryptionType,
            messageType: message.messageType,
            frameType,
            payloadSize: 0,
        });

        let totalSize = 0;
        if (frameType === FrameType.FIRST) {
            totalSize = message.getRawPayload().size;
        }

        return {
            frameHeader,
            payload,
            totalSize,
        };
    }

    public split(
        message: Message,
        encryptionType: EncryptionType,
    ): FrameData[] {
        this.logger.debug('Split message', {
            metadata: {
                message,
                encryptionType,
            },
        });
        const context = {
            remainingSize: message.payload.size,
        };
        const frameDatas: FrameData[] = [];

        while (context.remainingSize !== 0) {
            const frameData = this.splitOne(message, encryptionType, context);
            this.logger.debug('Split frame', {
                metadata: frameData,
            });
            frameDatas.push(frameData);
        }

        return frameDatas;
    }
}
