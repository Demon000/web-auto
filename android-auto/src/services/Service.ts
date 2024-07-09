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
import {
    Message as ProtoMessage,
    type BinaryReadOptions,
} from '@bufbuild/protobuf';
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

type MessageCallbackFn<T> = (data: T) => void | Promise<void>;

type MessageType<T> = {
    fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): T;
};

interface MessageCallback<T> {
    fn: MessageCallbackFn<T> | undefined;
    clazz: MessageType<T> | undefined;
}

export abstract class Service {
    public static nextServiceId = 1;

    protected logger = getLogger(this.constructor.name);

    public serviceId;

    protected started = false;

    private permanentSpecificMessageCallbacks = new Map<
        number,
        MessageCallback<any>
    >();
    private specificMessageCallbacks = new Map<number, MessageCallback<any>>();

    public constructor(
        protected events: ServiceEvents,
        serviceId?: number,
    ) {
        if (serviceId === undefined) {
            serviceId = Service.nextServiceId++;
        }

        this.serviceId = serviceId;
    }

    protected addMessageCallback<T>(
        id: number,
        fn?: MessageCallbackFn<T>,
        clazz?: MessageType<T>,
    ): void {
        assert(!this.permanentSpecificMessageCallbacks.has(id));
        this.permanentSpecificMessageCallbacks.set(id, {
            fn,
            clazz,
        });
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

    public handleControlMessage(
        messageId: number,
        payload: Uint8Array,
    ): boolean {
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

    public async handleSpecificMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean | void> {
        let callback = this.specificMessageCallbacks.get(messageId);
        if (callback === undefined) {
            callback = this.permanentSpecificMessageCallbacks.get(messageId);
        }

        if (callback === undefined) {
            return false;
        }

        if (callback.fn === undefined) {
            return true;
        }

        let data = payload;
        if (callback.clazz !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data = callback.clazz.fromBinary(payload);
        }
        this.printReceive(data);

        return callback.fn(data);
    }

    protected waitForSpecificMessage<T = Uint8Array>(
        messageId: number,
        signal: AbortSignal,
        clazz?: MessageType<T>,
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            assert(!this.specificMessageCallbacks.has(messageId));

            const onAbort = () => {
                this.logger.info(
                    `Aborted wait for message with id ${messageId}`,
                );
                this.specificMessageCallbacks.delete(messageId);
                reject(new Error('Aborted'));
            };

            const onMessage = (payload: T) => {
                this.logger.info(
                    `Received waited message with id ${messageId}`,
                );
                this.specificMessageCallbacks.delete(messageId);
                signal.removeEventListener('abort', onAbort);
                resolve(payload);
            };

            signal.addEventListener('abort', onAbort);

            this.specificMessageCallbacks.set(messageId, {
                clazz,
                fn: onMessage,
            });
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

    protected fillChannelDescriptor(_channelDescriptor: ProtoService): void {
        throw new Error('Channel descriptor filling not implemented');
    }

    public fillFeatures(response: ServiceDiscoveryResponse): void {
        const channelDescriptor = new ProtoService({
            id: this.serviceId,
        });

        try {
            this.fillChannelDescriptor(channelDescriptor);
        } catch (err) {
            this.logger.error('Failed to fill channel descriptor', err);
            return;
        }

        response.services.push(channelDescriptor);
    }
}
