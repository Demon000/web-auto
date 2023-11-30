import { EncryptionType } from '@/messenger/EncryptionType';
import { Message } from '@/messenger/Message';
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
import { getLogger } from '@web-auto/logging';

export interface ServiceEvents {
    onMessageSent: (
        message: Message,
        encryptionType: EncryptionType,
    ) => Promise<void>;
}

export abstract class Service {
    public static nextServiceId = 0;

    protected logger = getLogger(this.constructor.name);

    public serviceId = Service.nextServiceId++;
    public constructor(protected events: ServiceEvents) {}

    public async start(): Promise<void> {}
    public async stop(): Promise<void> {}

    protected async onChannelOpenRequest(
        data: ChannelOpenRequest,
    ): Promise<void> {
        let status = false;

        try {
            await this.open(data);
            status = true;
        } catch (err) {
            this.logger.error('Failed to open channel', {
                metadata: {
                    data,
                    err,
                },
            });
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

    protected async onControlMessage(message: Message): Promise<void> {
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
                    `Unhandled control message with id ${message.messageId}`,
                    {
                        metadata: message.getPayload(),
                    },
                );
        }
    }

    protected async onSpecificMessage(_message: Message): Promise<boolean> {
        return false;
    }

    private async onSpecificMessageWrapper(message: Message): Promise<void> {
        const handled = await this.onSpecificMessage(message);
        if (!handled) {
            this.logger.error(
                `Unhandled specific message with id ${message.messageId}`,
                {
                    metadata: message.getPayload(),
                },
            );
        }
    }

    public async onMessage(message: Message): Promise<void> {
        if (message.messageType === MessageType.CONTROL) {
            await this.onControlMessage(message);
        } else if (message.messageType === MessageType.SPECIFIC) {
            await this.onSpecificMessageWrapper(message);
        } else {
            this.logger.error(`Unhandled message type ${message.messageType}`);
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

    public async sendMessageWithId(
        messageId: number,
        dataPayload: DataBuffer,
        messageType: MessageType,
        encryptionType: EncryptionType,
    ): Promise<void> {
        const message = new Message({
            messageId,
            dataPayload,
            messageType,
            serviceId: this.serviceId,
        });

        try {
            await this.events.onMessageSent(message, encryptionType);
        } catch (err) {
            this.logger.error('Failed to emit message sent event', {
                metadata: err,
            });
        }
    }

    public async sendPlainSpecificMessage(
        messageId: number,
        payload: DataBuffer,
    ): Promise<void> {
        return this.sendMessageWithId(
            messageId,
            payload,
            MessageType.SPECIFIC,
            EncryptionType.PLAIN,
        );
    }

    public async sendEncryptedSpecificMessage(
        messageId: number,
        payload: DataBuffer,
    ): Promise<void> {
        return this.sendMessageWithId(
            messageId,
            payload,
            MessageType.SPECIFIC,
            EncryptionType.ENCRYPTED,
        );
    }

    public async sendEncryptedControlMessage(
        messageId: number,
        payload: DataBuffer,
    ): Promise<void> {
        return this.sendMessageWithId(
            messageId,
            payload,
            MessageType.CONTROL,
            EncryptionType.ENCRYPTED,
        );
    }

    protected abstract fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void;

    public fillFeatures(response: ServiceDiscoveryResponse): void {
        const channelDescriptor = ChannelDescriptor.create();
        channelDescriptor.channelId = this.serviceId;

        this.fillChannelDescriptor(channelDescriptor);

        response.channels.push(channelDescriptor);
    }
}
