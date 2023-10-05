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
    ServiceDiscoveryRequest,
    ServiceDiscoveryResponse,
    Status,
    VersionResponseStatus,
} from '@web-auto/android-auto-proto';

import { ChannelId } from '@/messenger/ChannelId';
import { Message } from '@/messenger/Message';
import { DataBuffer } from '@/utils/DataBuffer';

import { Service } from './Service';
import { EventEmitter } from 'eventemitter3';

export enum ControlServiceEvent {
    HANDSHAKE = 'handshake',
    SERVICE_DISCOVERY_REQUEST = 'service-discovery-request',
}

export interface ControlServiceEvents {
    [ControlServiceEvent.HANDSHAKE]: (payload?: DataBuffer) => void;
    [ControlServiceEvent.SERVICE_DISCOVERY_REQUEST]: (
        data: ServiceDiscoveryRequest,
    ) => void;
}

export class ControlService extends Service {
    public extraEmitter = new EventEmitter<ControlServiceEvents>();

    public constructor() {
        super(ChannelId.CONTROL);
    }

    private async onVersionReponse(payload: DataBuffer): Promise<void> {
        const majorCode = payload.readUint16BE();
        const mainorCode = payload.readUint16BE();
        const status = payload.readUint16BE();
        if (status === VersionResponseStatus.Enum.MISMATCH) {
            this.logger.error('Mismatched verion');
            return;
        }

        this.logger.info(
            `Major: ${majorCode}, minor: ${mainorCode}, status: ${status}`,
        );

        await this.onHandshake();
    }

    private async onHandshake(payload?: DataBuffer): Promise<void> {
        this.extraEmitter.emit(ControlServiceEvent.HANDSHAKE, payload);
    }

    private async onServiceDiscoveryRequest(
        data: ServiceDiscoveryRequest,
    ): Promise<void> {
        this.extraEmitter.emit(
            ControlServiceEvent.SERVICE_DISCOVERY_REQUEST,
            data,
        );
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

    public async onMessage(message: Message): Promise<void> {
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
                await super.onMessage(message);
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
        return this.sendVersionRequest();
    }

    public stop(): void {
        super.stop();
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
