import {
    ControlMessageType,
    ChannelOpenRequest,
    ChannelOpenResponse,
    MessageStatus,
    Service as ProtoService,
    ServiceDiscoveryResponse,
} from '@web-auto/android-auto-proto';
import { Message } from '../messenger/Message.js';
import { DataBuffer } from '../utils/DataBuffer.js';
import { getLogger } from '@web-auto/logging';
import assert from 'node:assert';
import { Message as ProtoMessage } from '@bufbuild/protobuf';

export interface ServiceEvents {
    onMessageSent: (
        serviceId: number,
        message: Message,
        isEncrypted: boolean,
        isControl: boolean,
    ) => Promise<void>;
}

export abstract class Service {
    public static nextServiceId = 0;

    protected logger = getLogger(this.constructor.name);

    public serviceId = Service.nextServiceId++;
    protected started = false;

    public constructor(protected events: ServiceEvents) {}

    public async start(): Promise<void> {
        assert(!this.started);

        this.started = true;
    }
    public async stop(): Promise<void> {
        assert(this.started);

        this.started = false;
    }

    protected async onChannelOpenRequest(
        data: ChannelOpenRequest,
    ): Promise<void> {
        let status = false;

        try {
            await this.open(data);
            status = true;
        } catch (err) {
            this.logger.error('Failed to open channel', {
                data,
                err,
            });
            return;
        }

        return this.sendChannelOpenResponse(status);
    }

    protected printReceive(message: any): void {
        if (!this.logger.debuggable) {
            return;
        }

        let extra = '';
        if (typeof message === 'string') {
            extra = message;
            message = undefined;
        } else if (message instanceof ProtoMessage) {
            extra = message.getType().typeName;
            message = message.toJson();
        }

        this.logger.debug(`Receive ${extra}`, message);
    }

    protected printSend(message: any): void {
        if (!this.logger.debuggable) {
            return;
        }

        let extra = '';
        if (typeof message === 'string') {
            extra = message;
            message = undefined;
        }

        if (message instanceof ProtoMessage) {
            extra = message.getType().typeName;
            message = message.toJson();
        }

        this.logger.debug(`Send ${extra}`, message);
    }

    public async onControlMessage(message: Message): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case ControlMessageType.MESSAGE_CHANNEL_OPEN_REQUEST:
                data = ChannelOpenRequest.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onChannelOpenRequest(data);
                break;
            default:
                return false;
        }

        return true;
    }

    public async onSpecificMessage(_message: Message): Promise<boolean> {
        return false;
    }

    protected abstract open(data: ChannelOpenRequest): Promise<void>;

    protected async sendChannelOpenResponse(status: boolean): Promise<void> {
        const data = new ChannelOpenResponse({
            status: status
                ? MessageStatus.STATUS_SUCCESS
                : MessageStatus.STATUS_INVALID_CHANNEL,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(data.toBinary());

        await this.sendEncryptedControlMessage(
            ControlMessageType.MESSAGE_CHANNEL_OPEN_RESPONSE,
            payload,
        );
    }

    public async sendMessageWithId(
        messageId: number,
        dataPayload: DataBuffer,
        isEncrypted: boolean,
        isControl: boolean,
    ): Promise<void> {
        const message = new Message({
            messageId,
            dataPayload,
        });

        try {
            await this.events.onMessageSent(
                this.serviceId,
                message,
                isEncrypted,
                isControl,
            );
        } catch (err) {
            this.logger.error('Failed to emit message sent event', err);
        }
    }

    public async sendPlainSpecificMessage(
        messageId: number,
        payload: DataBuffer,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, payload, false, false);
    }

    public async sendEncryptedSpecificMessage(
        messageId: number,
        payload: DataBuffer,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, payload, true, false);
    }

    public async sendEncryptedControlMessage(
        messageId: number,
        payload: DataBuffer,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, payload, true, true);
    }

    protected abstract fillChannelDescriptor(
        channelDescriptor: ProtoService,
    ): void;

    public fillFeatures(response: ServiceDiscoveryResponse): void {
        const channelDescriptor = new ProtoService({
            id: this.serviceId,
        });

        this.fillChannelDescriptor(channelDescriptor);

        response.services.push(channelDescriptor);
    }
}
