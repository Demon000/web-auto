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
import { DataBuffer } from '@/utils/DataBuffer';

import { Service } from './Service';
import { Pinger } from './Pinger';
import Long from 'long';
import assert from 'node:assert';

export interface ControlServiceEvents {
    onHandshake: (payload?: DataBuffer) => Promise<void>;
    onDiscoveryRequest: (data: ServiceDiscoveryRequest) => Promise<void>;
    onPingTimeout: () => Promise<void>;
}

export interface ControlServiceConfig {
    pingTimeoutMs: number;
}

export class ControlService extends Service {
    private pinger;

    public constructor(
        private config: ControlServiceConfig,
        private events: ControlServiceEvents,
    ) {
        super(ChannelId.CONTROL);

        this.pinger = new Pinger(config.pingTimeoutMs, {
            onPingTimeout: this.events.onPingTimeout,
            onPingRequest: this.onPingRequest,
        });

        this.sendPingRequest = this.sendPingRequest.bind(this);
    }

    public async onPingRequest(data: PingRequest): Promise<void> {
        assert(data.timestamp instanceof Long);
        await this.sendPingResponse(data.timestamp);
    }

    private async onVersionReponse(payload: DataBuffer): Promise<void> {
        const majorCode = payload.readUint16BE();
        const mainorCode = payload.readUint16BE();
        const status = payload.readUint16BE() as VersionResponseStatus.Enum;
        if (status === VersionResponseStatus.Enum.MISMATCH) {
            this.logger.error('Mismatched verion');
            return;
        }

        this.logger.info(
            `Major: ${majorCode}, minor: ${mainorCode}, status: ${status}`,
        );

        await this.events.onHandshake();
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

    public async onSpecificMessage(message: Message): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        const payload = message.getPayload();
        const messageId = message.messageId as ControlMessage.Enum;
        let data;

        switch (messageId) {
            case ControlMessage.Enum.VERSION_RESPONSE:
                await this.onVersionReponse(payload);
                break;
            case ControlMessage.Enum.SSL_HANDSHAKE:
                await this.events.onHandshake(payload);
                break;
            case ControlMessage.Enum.SERVICE_DISCOVERY_REQUEST:
                data = ServiceDiscoveryRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.events.onDiscoveryRequest(data);
                break;
            case ControlMessage.Enum.PING_REQUEST:
                data = PingRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onPingRequest(data);
                break;
            case ControlMessage.Enum.PING_RESPONSE:
                data = PingResponse.decode(bufferPayload);
                this.printReceive(data);
                this.pinger.onPingResponse(data);
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
                return super.onSpecificMessage(message);
        }

        return true;
    }

    private async sendPingResponse(timestamp: Long): Promise<void> {
        const data = PingResponse.create({
            timestamp,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            PingResponse.encode(data).finish(),
        );

        return this.sendPlainSpecificMessage(
            ControlMessage.Enum.PING_RESPONSE,
            payload,
        );
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

    public async sendHandshake(payload: DataBuffer): Promise<void> {
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

    private async sendPingRequest(data: PingRequest): Promise<void> {
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
        this.pinger.start();

        return this.sendVersionRequest();
    }

    public stop(): void {
        super.stop();
        this.pinger.stop();
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
