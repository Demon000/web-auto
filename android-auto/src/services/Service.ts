import {
    ControlMessageType,
    ChannelOpenRequest,
    ChannelOpenResponse,
    MessageStatus,
    Service as ProtoService,
    ServiceDiscoveryResponse,
} from '@web-auto/android-auto-proto';
import { Message } from '../messenger/Message.js';
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

type ServiceMessageCallback = (message: Message) => void;

export abstract class Service {
    public static nextServiceId = 0;

    protected logger = getLogger(this.constructor.name);

    public serviceId = Service.nextServiceId++;
    protected started = false;

    private specificMessageCallbacks = new Map<
        number,
        ServiceMessageCallback
    >();

    public constructor(protected events: ServiceEvents) {}

    public name(): string {
        return this.constructor.name;
    }

    public start(): void {
        assert(!this.started);

        this.started = true;
    }
    public stop(): void {
        assert(this.started);

        this.started = false;
        this.specificMessageCallbacks.clear();
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

    protected async onControlMessage(message: Message): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId as ControlMessageType) {
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

    public async handleControlMessage(message: Message): Promise<boolean> {
        return this.onControlMessage(message);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async onSpecificMessage(_message: Message): Promise<boolean> {
        return false;
    }

    public async handleSpecificMessage(message: Message): Promise<boolean> {
        const callback = this.specificMessageCallbacks.get(message.messageId);
        if (callback === undefined) {
            return this.onSpecificMessage(message);
        } else {
            callback(message);
            return true;
        }
    }

    protected waitForSpecificMessage(
        messageId: number,
        signal: AbortSignal,
    ): Promise<Message> {
        return new Promise((resolve, reject) => {
            assert(!this.specificMessageCallbacks.has(messageId));

            const onAbort = () => {
                this.logger.info(
                    `Aborted wait for message with id ${messageId}`,
                );
                this.specificMessageCallbacks.delete(messageId);
                reject(new Error('Aborted'));
            };

            const onMessage = (message: Message) => {
                this.logger.info(
                    `Received waited message with id ${messageId}`,
                );
                this.specificMessageCallbacks.delete(messageId);
                signal.removeEventListener('abort', onAbort);
                resolve(message);
            };

            signal.addEventListener('abort', onAbort);

            this.specificMessageCallbacks.set(messageId, onMessage);
        });
    }

    protected abstract open(data: ChannelOpenRequest): Promise<void>;

    protected async sendChannelOpenResponse(status: boolean): Promise<void> {
        const data = new ChannelOpenResponse({
            status: status
                ? MessageStatus.STATUS_SUCCESS
                : MessageStatus.STATUS_INVALID_CHANNEL,
        });

        await this.sendEncryptedControlMessage(
            ControlMessageType.MESSAGE_CHANNEL_OPEN_RESPONSE,
            data,
        );
    }

    protected async sendPayloadWithId(
        messageId: number,
        dataPayload: DataBuffer,
        printMessage: any,
        isEncrypted: boolean,
        isControl: boolean,
    ): Promise<void> {
        this.printSend(printMessage);

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
            throw err;
        }
    }

    protected async sendMessageWithId(
        messageId: number,
        protoMessage: ProtoMessage,
        isEncrypted: boolean,
        isControl: boolean,
    ): Promise<void> {
        const dataPayload = DataBuffer.fromBuffer(protoMessage.toBinary());

        return this.sendPayloadWithId(
            messageId,
            dataPayload,
            protoMessage,
            isEncrypted,
            isControl,
        );
    }

    protected async sendPlainSpecificMessage(
        messageId: number,
        message: ProtoMessage,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, message, false, false);
    }

    protected async sendEncryptedSpecificMessage(
        messageId: number,
        message: ProtoMessage,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, message, true, false);
    }

    protected async sendEncryptedControlMessage(
        messageId: number,
        message: ProtoMessage,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, message, true, true);
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
