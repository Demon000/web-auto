import { Message } from '../messenger/Message.js';
import {
    AVChannelMessage,
    AVInputChannel,
    AVInputOpenRequest,
    AVInputOpenResponse,
    AVMediaAckIndication,
    AVStreamType,
} from '@web-auto/android-auto-proto';
import { ChannelDescriptor } from '@web-auto/android-auto-proto';
import { DataBuffer } from '../utils/DataBuffer.js';
import { AVService } from './AVService.js';
import { microsecondsTime } from '../utils/time.js';
import { type ServiceEvents } from './Service.js';

export abstract class AudioInputService extends AVService {
    public constructor(protected events: ServiceEvents) {
        super(events);
    }

    protected channelCount(): number {
        return 1;
    }

    protected sampleRate(): number {
        return 16000;
    }

    protected chunkSize(): number {
        return 2048;
    }

    protected abstract inputOpen(data: AVInputOpenRequest): Promise<void>;

    protected async onInputOpenRequest(
        data: AVInputOpenRequest,
    ): Promise<void> {
        try {
            await this.inputOpen(data);
        } catch (err) {
            this.logger.error('Failed to open input', {
                data,
                err,
            });
            return;
        }

        await this.sendInputOpenResponse();
    }

    protected async onAckIndication(
        _data: AVMediaAckIndication,
    ): Promise<void> {}

    public async onSpecificMessage(message: Message): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case AVChannelMessage.Enum.AV_INPUT_OPEN_REQUEST:
                data = AVInputOpenRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onInputOpenRequest(data);
                break;
            case AVChannelMessage.Enum.AV_MEDIA_ACK_INDICATION:
                data = AVMediaAckIndication.decode(bufferPayload);
                this.printReceive(data);
                await this.onAckIndication(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
    }

    protected async sendInputOpenResponse(): Promise<void> {
        if (this.session === undefined) {
            this.logger.error(
                'Cannot send input open response because session id is undefined',
            );
            return;
        }

        const data = AVInputOpenResponse.create({
            value: 0,
            session: this.session,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            AVInputOpenResponse.encode(data).finish(),
        );

        await this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.AV_INPUT_OPEN_RESPONSE,
            payload,
        );
    }

    protected async sendAvMediaWithTimestampIndication(
        buffer: DataBuffer,
    ): Promise<void> {
        const payload = DataBuffer.empty();
        const timestamp = microsecondsTime();

        payload.appendUint64BELong(timestamp);
        payload.appendBuffer(buffer);

        await this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.AV_MEDIA_WITH_TIMESTAMP_INDICATION,
            payload,
        );
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.avInputChannel = AVInputChannel.create({
            streamType: AVStreamType.Enum.AUDIO,
            audioConfig: {
                sampleRate: this.sampleRate(),
                channelCount: this.channelCount(),
                bitDepth: 16,
            },
        });
    }
}
