import {
    ControlMessageType,
    ChannelOpenRequest,
    ChannelOpenResponse,
    MessageStatus,
    Service as ProtoService,
    ServiceDiscoveryResponse,
} from '@web-auto/android-auto-proto';
import { getLogger } from '@web-auto/logging';
import assert from 'node:assert';
import { Message as ProtoMessage } from '@bufbuild/protobuf';

export interface ServiceEvents {
    onProtoMessageSent: (
        serviceId: number,
        messageId: number,
        protoMessage: ProtoMessage,
        isEncrypted: boolean,
        isControl: boolean,
    ) => Promise<void>;
    onPayloadMessageSent: (
        serviceId: number,
        messageId: number,
        payload: Uint8Array,
        isEncrypted: boolean,
        isControl: boolean,
    ) => Promise<void>;
}

type ServiceMessageCallback = (messageId: number, payload: Uint8Array) => void;

export abstract class Service {
    public static nextServiceId = 1;

    protected logger = getLogger(this.constructor.name);

    public serviceId;

    protected started = false;

    private specificMessageCallbacks = new Map<
        number,
        ServiceMessageCallback
    >();

    public constructor(
        protected events: ServiceEvents,
        serviceId?: number,
    ) {
        if (serviceId === undefined) {
            serviceId = Service.nextServiceId++;
        }

        this.serviceId = serviceId;
    }

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
            this.open(data);
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

    protected async onControlMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        let data;

        switch (messageId as ControlMessageType) {
            case ControlMessageType.MESSAGE_CHANNEL_OPEN_REQUEST:
                data = ChannelOpenRequest.fromBinary(payload);
                this.printReceive(data);
                await this.onChannelOpenRequest(data);
                break;
            default:
                return false;
        }

        return true;
    }

    public async handleControlMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        return this.onControlMessage(messageId, payload);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async onSpecificMessage(
        _messageId: number,
        _payload: Uint8Array,
    ): Promise<boolean> {
        return false;
    }

    public async handleSpecificMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        const callback = this.specificMessageCallbacks.get(messageId);
        if (callback === undefined) {
            return this.onSpecificMessage(messageId, payload);
        } else {
            callback(messageId, payload);
            return true;
        }
    }

    protected waitForSpecificMessage(
        messageId: number,
        signal: AbortSignal,
    ): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            assert(!this.specificMessageCallbacks.has(messageId));

            const onAbort = () => {
                this.logger.info(
                    `Aborted wait for message with id ${messageId}`,
                );
                this.specificMessageCallbacks.delete(messageId);
                reject(new Error('Aborted'));
            };

            const onMessage = (messageId: number, payload: Uint8Array) => {
                this.logger.info(
                    `Received waited message with id ${messageId}`,
                );
                this.specificMessageCallbacks.delete(messageId);
                signal.removeEventListener('abort', onAbort);
                resolve(payload);
            };

            signal.addEventListener('abort', onAbort);

            this.specificMessageCallbacks.set(messageId, onMessage);
        });
    }

    protected open(_data: ChannelOpenRequest): void {}

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

    protected sendPayloadWithId(
        messageId: number,
        dataPayload: Uint8Array,
        printMessage: any,
        isEncrypted: boolean,
        isControl: boolean,
    ): Promise<void> {
        this.printSend(printMessage);

        return this.events.onPayloadMessageSent(
            this.serviceId,
            messageId,
            dataPayload,
            isEncrypted,
            isControl,
        );
    }

    protected sendMessageWithId(
        messageId: number,
        protoMessage: ProtoMessage,
        isEncrypted: boolean,
        isControl: boolean,
    ): Promise<void> {
        this.printSend(protoMessage);

        return this.events.onProtoMessageSent(
            this.serviceId,
            messageId,
            protoMessage,
            isEncrypted,
            isControl,
        );
    }

    protected sendPlainSpecificMessage(
        messageId: number,
        message: ProtoMessage,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, message, false, false);
    }

    protected sendEncryptedSpecificMessage(
        messageId: number,
        message: ProtoMessage,
    ): Promise<void> {
        return this.sendMessageWithId(messageId, message, true, false);
    }

    protected sendEncryptedControlMessage(
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
