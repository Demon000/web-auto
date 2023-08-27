import {
    AudioFocusRequest,
    AudioFocusResponse,
    AudioFocusState,
    AudioFocusType,
    AuthCompleteIndication,
    ChannelDescriptor,
    ChannelOpenRequest,
    ControlMessage,
    NavigationFocusRequest,
    NavigationFocusResponse,
    PingRequest,
    PingResponse,
    ServiceDiscoveryRequest,
    ServiceDiscoveryResponse,
    Status,
    VersionResponseStatus,
} from '@web-auto/android-auto-proto';

import { ChannelId } from '@/messenger/ChannelId';
import { Message } from '@/messenger/Message';
import { MessageInStream } from '@/messenger/MessageInStream';
import { MessageOutStream } from '@/messenger/MessageOutStream';
import { DataBuffer } from '@/utils/DataBuffer';
import { microsecondsTime } from '@/utils/time';
import { MessageFrameOptions } from '@/messenger/MessageFrameOptions';
import { ICryptor } from '@/ssl/ICryptor';

import { Service } from './Service';
import { EventEmitter } from 'eventemitter3';

export enum ControlServiceEvent {
    SERVICE_DISCOVERY_REQUEST = 'service-discovery-request',
}

export interface ControlServiceEvents {
    [ControlServiceEvent.SERVICE_DISCOVERY_REQUEST]: (
        data: ServiceDiscoveryRequest,
    ) => void;
}

export class ControlService extends Service {
    public emitter = new EventEmitter<ControlServiceEvents>();
    private pingTimeout?: NodeJS.Timeout;

    public constructor(
        private cryptor: ICryptor,
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.CONTROL, messageInStream, messageOutStream);

        this.onPingTimeout = this.onPingTimeout.bind(this);
    }

    public schedulePing(): void {
        this.pingTimeout = setTimeout(this.onPingTimeout, 5000);
    }

    public cancelPing(): void {
        clearTimeout(this.pingTimeout);
    }

    public async onPingTimeout(): Promise<void> {
        await this.sendPingRequest();
        this.schedulePing();
    }

    public async onPingResponse(_data: PingResponse): Promise<void> {
        // TODO
    }

    private async onVersionReponse(payload: DataBuffer): Promise<void> {
        const majorCode = payload.readUint16BE();
        const mainorCode = payload.readUint16BE();
        const status = payload.readUint16BE();
        if (status === VersionResponseStatus.Enum.MISMATCH) {
            throw new Error('Mismatched verion');
        }

        console.log(
            `Major: ${majorCode}, minor: ${mainorCode}, status: ${status}`,
        );

        await this.onHandshake();
    }

    private async onHandshake(payload?: DataBuffer): Promise<void> {
        if (payload !== undefined) {
            this.cryptor.writeHandshakeBuffer(payload);
        }

        if (this.cryptor.doHandshake()) {
            console.log('Auth completed');

            await this.sendAuthComplete();
        } else {
            console.log('Continue handshake');

            await this.sendHandshake();
        }
    }

    private async onServiceDiscoveryRequest(
        data: ServiceDiscoveryRequest,
    ): Promise<void> {
        this.emitter.emit(ControlServiceEvent.SERVICE_DISCOVERY_REQUEST, data);
    }

    private async onAudioFocusRequest(data: AudioFocusRequest): Promise<void> {
        const audioFocusState =
            data.audioFocusType === AudioFocusType.Enum.RELEASE
                ? AudioFocusState.Enum.LOSS
                : AudioFocusState.Enum.GAIN;

        return this.sendAudioFocusResponse(audioFocusState);
    }

    private async onNavigationFocusRequest(
        _data: NavigationFocusRequest,
    ): Promise<void> {
        return this.sendNavigationFocusResponse(2);
    }

    protected async onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        const payload = message.getPayload();
        let data;

        switch (message.messageId) {
            case ControlMessage.Enum.VERSION_RESPONSE:
                await this.onVersionReponse(payload);
                break;
            case ControlMessage.Enum.SSL_HANDSHAKE:
                await this.onHandshake(payload);
                break;
            case ControlMessage.Enum.SERVICE_DISCOVERY_REQUEST:
                data = ServiceDiscoveryRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onServiceDiscoveryRequest(data);
                break;
            case ControlMessage.Enum.PING_RESPONSE:
                data = PingResponse.decode(bufferPayload);
                this.printReceive(data);
                await this.onPingResponse(data);
                break;
            case ControlMessage.Enum.AUDIO_FOCUS_REQUEST:
                data = AudioFocusRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onAudioFocusRequest(data);
                break;
            case ControlMessage.Enum.NAVIGATION_FOCUS_REQUEST:
                data = NavigationFocusRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onNavigationFocusRequest(data);
                break;
            default:
                await super.onMessage(message, options);
        }
    }

    private async sendVersionRequest(): Promise<void> {
        const payload = DataBuffer.fromSize(4)
            .appendUint16BE(1)
            .appendUint16BE(6);

        this.printSend('version request');

        await this.sendPlainSpecificMessage(
            ControlMessage.Enum.VERSION_REQUEST,
            payload,
        );
    }

    private async sendHandshake(): Promise<void> {
        const payload = this.cryptor.readHandshakeBuffer();
        this.printSend('handshake');

        await this.sendPlainSpecificMessage(
            ControlMessage.Enum.SSL_HANDSHAKE,
            payload,
        );
    }

    public async sendAuthComplete(): Promise<void> {
        const data = AuthCompleteIndication.create({
            status: Status.Enum.OK,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            AuthCompleteIndication.encode(data).finish(),
        );

        await this.sendPlainSpecificMessage(
            ControlMessage.Enum.AUTH_COMPLETE,
            payload,
        );
    }

    private async sendPingRequest(): Promise<void> {
        const data = PingRequest.create({
            timestamp: microsecondsTime(),
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            PingRequest.encode(data).finish(),
        );

        await this.sendPlainSpecificMessage(
            ControlMessage.Enum.PING_REQUEST,
            payload,
        );
    }

    private async sendAudioFocusResponse(
        audioFocusState: AudioFocusState.Enum,
    ): Promise<void> {
        const data = AudioFocusResponse.create({
            audioFocusState,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            AudioFocusResponse.encode(data).finish(),
        );

        await this.sendEncryptedSpecificMessage(
            ControlMessage.Enum.AUDIO_FOCUS_RESPONSE,
            payload,
        );
    }

    private async sendNavigationFocusResponse(type: number): Promise<void> {
        const data = NavigationFocusResponse.create({
            type,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            NavigationFocusResponse.encode(data).finish(),
        );

        await this.sendEncryptedSpecificMessage(
            ControlMessage.Enum.NAVIGATION_FOCUS_RESPONSE,
            payload,
        );
    }

    public async sendDiscoveryResponse(
        data: ServiceDiscoveryResponse,
    ): Promise<void> {
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            ServiceDiscoveryResponse.encode(data).finish(),
        );

        await this.sendEncryptedSpecificMessage(
            ControlMessage.Enum.SERVICE_DISCOVERY_RESPONSE,
            payload,
        );
    }

    public async start(): Promise<void> {
        this.schedulePing();

        return this.sendVersionRequest();
    }

    public stop(): void {
        this.cancelPing();
    }

    protected fillChannelDescriptor(
        _channelDescriptor: ChannelDescriptor,
    ): void {
        throw new Error('Control service does not support discovery');
    }

    protected open(_data: ChannelOpenRequest): Promise<void> {
        throw new Error('Control service does not support openning channel');
    }
}
