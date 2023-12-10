import {
    AudioFocusNotification,
    AudioFocusRequestNotification,
    AudioFocusRequestType,
    AudioFocusStateType,
    AuthResponse,
    ChannelOpenRequest,
    ControlMessageType,
    MessageStatus,
    NavFocusNotification,
    NavFocusRequestNotification,
    NavFocusType,
    PingRequest,
    PingResponse,
    ServiceDiscoveryRequest,
    ServiceDiscoveryResponse,
    type Service as ProtoService,
    GalConstants,
} from '@web-auto/android-auto-proto';

import { Message } from '../messenger/Message.js';
import { DataBuffer } from '../utils/DataBuffer.js';

import { Service, type ServiceEvents } from './Service.js';
import { Pinger } from './Pinger.js';
import assert from 'node:assert';

export interface ControlServiceEvents extends ServiceEvents {
    onHandshake: (payload?: DataBuffer) => Promise<void>;
    onServiceDiscoveryRequest: (data: ServiceDiscoveryRequest) => Promise<void>;
    onPingTimeout: () => Promise<void>;
}

export interface ControlServiceConfig {
    pingTimeoutMs: number;
}

export class ControlService extends Service {
    private pinger;

    public constructor(
        private config: ControlServiceConfig,
        protected events: ControlServiceEvents,
    ) {
        super(events);

        assert(this.serviceId === 0);

        this.pinger = new Pinger(config.pingTimeoutMs, {
            onPingTimeout: this.events.onPingTimeout,
            onPingRequest: this.sendPingRequest.bind(this),
        });
    }

    public async onPingRequest(data: PingRequest): Promise<void> {
        assert(data.timestamp !== undefined);
        await this.sendPingResponse(data.timestamp);
    }

    private async onVersionReponse(payload: DataBuffer): Promise<void> {
        const majorCode = payload.readUint16BE();
        const mainorCode = payload.readUint16BE();
        const status = payload.readUint16BE() as MessageStatus;
        if (status === MessageStatus.STATUS_NO_COMPATIBLE_VERSION) {
            this.logger.error('Mismatched verion');
            return;
        }

        this.logger.info(
            `Major: ${majorCode}, minor: ${mainorCode}, status: ${status}`,
        );

        try {
            await this.events.onHandshake();
        } catch (err) {
            this.logger.error('Failed to emit handshake event', err);
        }
    }

    private async onAudioFocusRequest(
        data: AudioFocusRequestNotification,
    ): Promise<void> {
        const audioFocusState =
            data.request === AudioFocusRequestType.AUDIO_FOCUS_RELEASE
                ? AudioFocusStateType.AUDIO_FOCUS_STATE_LOSS
                : AudioFocusStateType.AUDIO_FOCUS_STATE_GAIN;

        return this.sendAudioFocusResponse(audioFocusState);
    }

    private async onNavigationFocusRequest(
        _data: NavFocusRequestNotification,
    ): Promise<void> {
        return this.sendNavigationFocusResponse(
            NavFocusType.NAV_FOCUS_PROJECTED,
        );
    }

    public async onSpecificMessage(message: Message): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        const payload = message.getPayload();
        const messageId = message.messageId as ControlMessageType;
        let data;

        switch (messageId) {
            case ControlMessageType.MESSAGE_VERSION_RESPONSE:
                await this.onVersionReponse(payload);
                break;
            case ControlMessageType.MESSAGE_ENCAPSULATED_SSL:
                try {
                    await this.events.onHandshake(payload);
                } catch (err) {
                    this.logger.error('Failed to emit handshake event', err);
                }
                break;
            case ControlMessageType.MESSAGE_SERVICE_DISCOVERY_REQUEST:
                data = ServiceDiscoveryRequest.fromBinary(bufferPayload);
                this.printReceive(data);
                try {
                    await this.events.onServiceDiscoveryRequest(data);
                } catch (err) {
                    this.logger.error(
                        'Failed to emit service discovery request event',
                        err,
                    );
                }
                break;
            case ControlMessageType.MESSAGE_PING_REQUEST:
                data = PingRequest.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onPingRequest(data);
                break;
            case ControlMessageType.MESSAGE_PING_RESPONSE:
                data = PingResponse.fromBinary(bufferPayload);
                this.printReceive(data);
                this.pinger.onPingResponse(data);
                break;
            case ControlMessageType.MESSAGE_AUDIO_FOCUS_REQUEST:
                data = AudioFocusRequestNotification.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onAudioFocusRequest(data);
                break;
            case ControlMessageType.MESSAGE_NAV_FOCUS_REQUEST:
                data = NavFocusRequestNotification.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onNavigationFocusRequest(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
    }

    private async sendPingResponse(timestamp: bigint): Promise<void> {
        const data = new PingResponse({
            timestamp,
            data: new Uint8Array(),
        });

        return this.sendPlainSpecificMessage(
            ControlMessageType.MESSAGE_PING_RESPONSE,
            data,
        );
    }
    private async sendVersionRequest(): Promise<void> {
        const payload = DataBuffer.fromSize(4)
            .appendUint16BE(GalConstants.PROTOCOL_MAJOR_VERSION)
            .appendUint16BE(GalConstants.PROTOCOL_MINOR_VERSION);

        await this.sendPayloadWithId(
            ControlMessageType.MESSAGE_VERSION_REQUEST,
            payload,
            'version request',
            false,
            false,
        );
    }

    public async sendHandshake(payload: DataBuffer): Promise<void> {
        await this.sendPayloadWithId(
            ControlMessageType.MESSAGE_ENCAPSULATED_SSL,
            payload,
            'handshake',
            false,
            false,
        );
    }

    public async sendAuthComplete(): Promise<void> {
        const data = new AuthResponse({
            status: 0,
        });

        await this.sendPlainSpecificMessage(
            ControlMessageType.MESSAGE_AUTH_COMPLETE,
            data,
        );
    }

    private async sendPingRequest(data: PingRequest): Promise<void> {
        await this.sendPlainSpecificMessage(
            ControlMessageType.MESSAGE_PING_REQUEST,
            data,
        );
    }

    private async sendAudioFocusResponse(
        focusState: AudioFocusStateType,
    ): Promise<void> {
        const data = new AudioFocusNotification({
            focusState,
            unsolicited: false,
        });

        await this.sendEncryptedSpecificMessage(
            ControlMessageType.MESSAGE_AUDIO_FOCUS_NOTIFICATION,
            data,
        );
    }

    private async sendNavigationFocusResponse(
        focusType: NavFocusType,
    ): Promise<void> {
        const data = new NavFocusNotification({
            focusType,
        });

        await this.sendEncryptedSpecificMessage(
            ControlMessageType.MESSAGE_NAV_FOCUS_NOTIFICATION,
            data,
        );
    }

    public async sendDiscoveryResponse(
        data: ServiceDiscoveryResponse,
    ): Promise<void> {
        await this.sendEncryptedSpecificMessage(
            ControlMessageType.MESSAGE_SERVICE_DISCOVERY_RESPONSE,
            data,
        );
    }

    public async start(): Promise<void> {
        await super.start();

        this.pinger.start();

        try {
            await this.sendVersionRequest();
        } catch (err) {
            this.logger.error('Failed to send version request', err);
            this.pinger.stop();
            throw err;
        }
    }

    public async stop(): Promise<void> {
        await super.stop();
        this.pinger.stop();
    }

    protected fillChannelDescriptor(_channelDescriptor: ProtoService): void {
        throw new Error('Control service does not support discovery');
    }

    protected open(_data: ChannelOpenRequest): Promise<void> {
        throw new Error('Control service does not support openning channel');
    }
}
