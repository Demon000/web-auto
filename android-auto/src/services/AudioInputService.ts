import { ChannelId } from '@/messenger/ChannelId';
import { Message } from '@/messenger/Message';
import { MessageFrameOptions } from '@/messenger/MessageFrameOptions';
import {
    AVChannelMessage,
    AVInputChannel,
    AVInputOpenRequest,
    AVInputOpenResponse,
    AVStreamType,
} from '@web-auto/android-auto-proto';
import { ChannelDescriptor } from '@web-auto/android-auto-proto';
import { DataBuffer } from '@/utils/DataBuffer';
import { AVService } from './AVService';
import { microsecondsTime } from '@/utils/time';

export abstract class AudioInputService extends AVService {
    public constructor() {
        super(ChannelId.AV_INPUT);
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
        } catch (e) {
            console.log(e);
        }

        this.sendInputOpenResponse();
    }

    public async onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case AVChannelMessage.Enum.AV_INPUT_OPEN_REQUEST:
                data = AVInputOpenRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onInputOpenRequest(data);
                break;
            default:
                await super.onMessage(message, options);
        }
    }

    protected async sendInputOpenResponse(): Promise<void> {
        if (this.session === undefined) {
            console.log(
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

        payload.appendUint64BE(timestamp);
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
