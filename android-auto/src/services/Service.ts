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
import { bufferWrapUint8Array } from '../utils/buffer.js';

export interface ServiceEvents {
    onProtoMessageSent: (
        serviceId: number,
        messageId: number,
        protoMessage: ProtoMessage,
        isEncrypted: boolean,
        isControl: boolean,
    ) => void;
    onPayloadMessageSent: (
        serviceId: number,
        messageId: number,
        payload: Uint8Array,
        isEncrypted: boolean,
        isControl: boolean,
    ) => void;
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

    public async init(): Promise<void> {}

    public destroy(): void {}

    public start(): void {
        assert(!this.started);

        this.started = true;
    }
    public stop(): void {
        assert(this.started);

        this.started = false;
        this.specificMessageCallbacks.clear();
    }

    protected open(_data: ChannelOpenRequest): void {}

    protected onChannelOpenRequest(data: ChannelOpenRequest): void {
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

        this.sendChannelOpenResponse(status);
    }

    protected printMessage(type: string, message: any, extra?: string): void {
        if (!this.logger.debuggable) {
            return;
        }

        if (message instanceof ProtoMessage) {
            if (extra === undefined) {
                extra = message.getType().typeName;
            }
            message = message.toJson();
        } else if (message instanceof Uint8Array) {
            if (extra === undefined) {
                extra = 'Uint8Array';
            }
            const buffer = bufferWrapUint8Array(message);
            message = buffer.toString('hex');
        }

        this.logger.debug(`${type} ${extra}`, message);
    }

    protected printReceive(message: any, extra?: string): void {
        this.printMessage('Receive', message, extra);
    }

    protected printSend(message: any, extra?: string): void {
        this.printMessage('Send', message, extra);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async onControlMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        let data;

        switch (messageId as ControlMessageType) {
            case ControlMessageType.MESSAGE_CHANNEL_OPEN_REQUEST:
                data = ChannelOpenRequest.fromBinary(payload);
                this.printReceive(data);
                this.onChannelOpenRequest(data);
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

    protected sendChannelOpenResponse(status: boolean): void {
        const data = new ChannelOpenResponse({
            status: status
                ? MessageStatus.STATUS_SUCCESS
                : MessageStatus.STATUS_INVALID_CHANNEL,
        });

        this.sendEncryptedControlMessage(
            ControlMessageType.MESSAGE_CHANNEL_OPEN_RESPONSE,
            data,
        );
    }

    protected sendPayloadWithId(
        messageId: number,
        dataPayload: Uint8Array,
        printMessage: string,
        isEncrypted: boolean,
        isControl: boolean,
    ): void {
        this.printSend(dataPayload, printMessage);

        this.events.onPayloadMessageSent(
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
    ): void {
        this.printSend(protoMessage);

        this.events.onProtoMessageSent(
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
    ): void {
        this.sendMessageWithId(messageId, message, false, false);
    }

    protected sendEncryptedSpecificMessage(
        messageId: number,
        message: ProtoMessage,
    ): void {
        this.sendMessageWithId(messageId, message, true, false);
    }

    protected sendEncryptedControlMessage(
        messageId: number,
        message: ProtoMessage,
    ): void {
        this.sendMessageWithId(messageId, message, true, true);
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
