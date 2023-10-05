import { EncryptionType } from '@/messenger/EncryptionType';
import { Message } from '@/messenger/Message';
import { MessageFrameOptions } from '@/messenger/MessageFrameOptions';
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
import EventEmitter from 'eventemitter3';
import { getLogger } from '@web-auto/logging';

export type ServiceSendMessageOptions = Omit<MessageFrameOptions, 'channelId'>;

export enum ServiceEvent {
    MESSAGE_SENT = 'message-sent',
}

export interface ServiceEvents {
    [ServiceEvent.MESSAGE_SENT]: (
        message: Message,
        options: ServiceSendMessageOptions,
    ) => void;
}

export abstract class Service {
    protected logger = getLogger(this.constructor.name);

    public emitter = new EventEmitter<ServiceEvents>();

    public constructor(public channelId: number) {}

    public async start(): Promise<void> {}
    public stop(): void {
        this.emitter.removeAllListeners();
    }

    protected async onChannelOpenRequest(
        data: ChannelOpenRequest,
    ): Promise<void> {
        let status = false;

        try {
            await this.open(data);
            status = true;
        } catch (e) {
            this.logger.error(e);
            return;
        }

        return this.sendChannelOpenResponse(status);
    }

    protected printReceive(message: any): void {
        let extra = '';
        if (typeof message === 'string') {
            extra = message;
            message = undefined;
        }
        this.logger.debug(`Receive ${extra}`, {
            metadata: message,
        });
    }

    protected printSend(message: any): void {
        let extra = '';
        if (typeof message === 'string') {
            extra = message;
            message = undefined;
        }
        this.logger.debug(`Send ${extra}`, {
            metadata: message,
        });
    }

    public async onMessage(message: Message): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case ControlMessage.Enum.CHANNEL_OPEN_REQUEST:
                data = ChannelOpenRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onChannelOpenRequest(data);
                break;
            default:
                this.logger.error(
                    `Unhandled message with id ${message.messageId} ` +
                        `on service ${this.constructor.name}`,
                    {
                        metadata: message.getPayload(),
                    },
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
        this.emitter.emit(ServiceEvent.MESSAGE_SENT, message, options);
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
