import { channelIdString } from '../messenger/ChannelId';
import { EncryptionType } from '../messenger/EncryptionType';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import {
    MessageInStream,
    MessageInStreamEvent,
} from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { MessageType } from '../messenger/MessageType';
import { ChannelDescriptor } from '../proto/types/ChannelDescriptorData';
import { ChannelOpenRequest } from '../proto/types/ChannelOpenRequestMessage';
import { ChannelOpenResponse } from '../proto/types/ChannelOpenResponseMessage';
import { ControlMessage_Enum } from '../proto/types/ControlMessageIdsEnum';
import { ServiceDiscoveryResponse } from '../proto/types/ServiceDiscoveryResponseMessage';
import { Status_Enum } from '../proto/types/StatusEnum';
import { DataBuffer } from '../utils/DataBuffer';

export type ServiceSendMessageOptions = Omit<MessageFrameOptions, 'channelId'>;

export abstract class Service {
    public constructor(
        protected channelId: number,
        protected messageInStream: MessageInStream,
        protected messageOutStream: MessageOutStream,
    ) {
        this.messageInStream
            .channelEmitter(this.channelId)
            .on(
                MessageInStreamEvent.MESSAGE_RECEIVED,
                this.onMessageInner.bind(this),
            );
    }

    private async onMessageInner(
        message: Message,
        options?: MessageFrameOptions,
    ): Promise<void> {
        switch (message.messageId) {
            case ControlMessage_Enum.CHANNEL_OPEN_REQUEST:
                return this.onChannelOpenRequest(message);
        }

        const found = this.onMessage(message, options);
        if (found) {
            return;
        }

        console.log(
            `Unhandled message with id ${
                message.messageId
            } on channel ${channelIdString(this.channelId)}`,
            message.getPayload(),
            options,
        );
    }

    protected abstract openChannel(data: ChannelOpenRequest): Promise<void>;

    protected async onChannelOpenRequest(message: Message): Promise<void> {
        const data = ChannelOpenRequest.decode(message.getBufferPayload());
        let status = false;

        try {
            await this.openChannel(data);
            status = true;
        } catch (e) {
            console.log(e);
        }

        return this.sendChannelOpenResponse(status);
    }

    protected async sendChannelOpenResponse(status: boolean): Promise<void> {
        const data = ChannelOpenResponse.create({
            status: status ? Status_Enum.OK : Status_Enum.FAIL,
        });

        const payload = DataBuffer.fromBuffer(
            ChannelOpenResponse.encode(data).finish(),
        );

        return this.sendEncryptedControlMessage(
            ControlMessage_Enum.CHANNEL_OPEN_RESPONSE,
            payload,
        );
    }

    protected abstract onMessage(
        message: Message,
        options?: MessageFrameOptions,
    ): boolean;

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

    public async sendPlainControlMessage(
        messageId: number,
        payload: DataBuffer,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, payload, {
            encryptionType: EncryptionType.PLAIN,
            messageType: MessageType.CONTROL,
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
