import { channelIdString } from '@/messenger/ChannelId';
import { EncryptionType } from '@/messenger/EncryptionType';
import { Message } from '@/messenger/Message';
import { MessageFrameOptions } from '@/messenger/MessageFrameOptions';
import {
    MessageInStream,
    MessageInStreamEvent,
} from '@/messenger/MessageInStream';
import { MessageOutStream } from '@/messenger/MessageOutStream';
import { MessageType } from '@/messenger/MessageType';
import {
    ChannelDescriptor,
    ChannelOpenRequest,
    ChannelOpenResponse,
    ControlMessage,
    ServiceDiscoveryResponse,
    Status,
} from '@web-auto/android-auto-proto';
import { DataBuffer } from '@/utils/DataBuffer';

export type ServiceSendMessageOptions = Omit<MessageFrameOptions, 'channelId'>;

export abstract class Service {
    protected channelName;

    public constructor(
        protected channelId: number,
        protected messageInStream: MessageInStream,
        protected messageOutStream: MessageOutStream,
        protected debug = false,
    ) {
        this.channelName = channelIdString(channelId);

        this.messageInStream
            .channelEmitter(this.channelId)
            .on(
                MessageInStreamEvent.MESSAGE_RECEIVED,
                this.onMessage.bind(this),
            );
    }

    public async start(): Promise<void> {}
    public stop(): void {}

    protected async onChannelOpenRequest(
        data: ChannelOpenRequest,
    ): Promise<void> {
        let status = false;

        try {
            await this.open(data);
            status = true;
        } catch (e) {
            console.log(e);
        }

        return this.sendChannelOpenResponse(status);
    }

    protected printReceive(message: any): void {
        if (!this.debug) {
            return;
        }

        console.log(
            this.channelName,
            'Receive',
            message.constructor.name,
            JSON.stringify(message, null, 4),
        );
    }

    protected printSend(message: any): void {
        if (!this.debug) {
            return;
        }

        console.log(
            this.channelName,
            'Send',
            message.constructor.name,
            JSON.stringify(message, null, 4),
        );
    }

    protected async onMessage(
        message: Message,
        options?: MessageFrameOptions,
    ): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case ControlMessage.Enum.CHANNEL_OPEN_REQUEST:
                data = ChannelOpenRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onChannelOpenRequest(data);
                break;
            default:
                console.log(
                    `Unhandled message with id ${message.messageId} on channel ${this.channelName}`,
                    message.getPayload(),
                    options,
                );
        }
    }

    protected abstract open(data: ChannelOpenRequest): Promise<void>;

    protected async sendChannelOpenResponse(status: boolean): Promise<void> {
        const data = ChannelOpenResponse.create({
            status: status ? Status.Enum.OK : Status.Enum.FAIL,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            ChannelOpenResponse.encode(data).finish(),
        );

        await this.sendEncryptedControlMessage(
            ControlMessage.Enum.CHANNEL_OPEN_RESPONSE,
            payload,
        );
    }

    public async sendMessage(
        message: Message,
        options: ServiceSendMessageOptions,
    ): Promise<void> {
        return this.messageOutStream.send(message, {
            channelId: this.channelId,
            ...options,
        });
    }

    public async sendMessageWithId(
        messageId: number,
        dataPayload: DataBuffer,
        options: ServiceSendMessageOptions,
    ): Promise<void> {
        const message = new Message({
            messageId,
            dataPayload,
        });

        return this.sendMessage(message, options);
    }

    public async sendPlainSpecificMessage(
        messageId: number,
        payload: DataBuffer,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, payload, {
            encryptionType: EncryptionType.PLAIN,
            messageType: MessageType.SPECIFIC,
        });
    }

    public async sendEncryptedSpecificMessage(
        messageId: number,
        payload: DataBuffer,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, payload, {
            encryptionType: EncryptionType.ENCRYPTED,
            messageType: MessageType.SPECIFIC,
        });
    }

    public async sendEncryptedControlMessage(
        messageId: number,
        payload: DataBuffer,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, payload, {
            encryptionType: EncryptionType.ENCRYPTED,
            messageType: MessageType.CONTROL,
        });
    }

    protected abstract fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void;

    public fillFeatures(response: ServiceDiscoveryResponse): void {
        const channelDescriptor = ChannelDescriptor.create();
        channelDescriptor.channelId = this.channelId;

        this.fillChannelDescriptor(channelDescriptor);

        response.channels.push(channelDescriptor);
    }
}
