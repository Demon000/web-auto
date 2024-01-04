import {
    AudioFocusNotification,
    AudioFocusRequestNotification,
    AudioFocusRequestType,
    AudioFocusStateType,
    AuthResponse,
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
    VoiceSessionNotification,
    BatteryStatusNotification,
} from '@web-auto/android-auto-proto';

import { Message } from '../messenger/Message.js';

import { Service, type ServiceEvents } from './Service.js';
import { Pinger } from './Pinger.js';
import assert from 'node:assert';
import type { Cryptor } from '../crypto/Cryptor.js';
import { BufferWriter, BufferReader } from '../utils/buffer.js';

export interface ControlServiceEvents extends ServiceEvents {
    getServiceDiscoveryResponse: () => ServiceDiscoveryResponse;
    onPingTimeout: () => void;
}

export interface ControlServiceConfig {
    pingTimeoutMs: number;
    startTimeoutMs: number;
}

export class ControlService extends Service {
    private pinger;

    public constructor(
        private cryptor: Cryptor,
        private config: ControlServiceConfig,
        protected override events: ControlServiceEvents,
    ) {
        super(events);

        assert(this.serviceId === 0);

        this.pinger = new Pinger(config.pingTimeoutMs, {
            onPingTimeout: this.events.onPingTimeout,
            onPingRequest: this.sendPingRequest.bind(this),
        });
    }

    private async onPingRequest(data: PingRequest): Promise<void> {
        assert(data.timestamp !== undefined);
        await this.sendPingResponse(data.timestamp);
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
        data: NavFocusRequestNotification,
    ): Promise<void> {
        if (data.focusType === undefined) {
            return;
        }

        return this.sendNavigationFocusResponse(data.focusType);
    }

    protected async onVoiceSessionNotification(
        _data: VoiceSessionNotification,
    ): Promise<void> {}

    protected async onBatteryStatusNotification(
        _data: BatteryStatusNotification,
    ): Promise<void> {}

    protected override async onSpecificMessage(
        message: Message,
    ): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        const messageId = message.messageId as ControlMessageType;
        let data;

        switch (messageId) {
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
            case ControlMessageType.MESSAGE_VOICE_SESSION_NOTIFICATION:
                data = VoiceSessionNotification.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onVoiceSessionNotification(data);
                break;
            case ControlMessageType.MESSAGE_BATTERY_STATUS_NOTIFICATION:
                data = BatteryStatusNotification.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onBatteryStatusNotification(data);
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
        const writer = BufferWriter.fromSize(4)
            .appendUint16BE(GalConstants.PROTOCOL_MAJOR_VERSION)
            .appendUint16BE(GalConstants.PROTOCOL_MINOR_VERSION);

        await this.sendPayloadWithId(
            ControlMessageType.MESSAGE_VERSION_REQUEST,
            writer.data,
            'version request',
            false,
            false,
        );
    }

    private async sendHandshake(payload: Uint8Array): Promise<void> {
        await this.sendPayloadWithId(
            ControlMessageType.MESSAGE_ENCAPSULATED_SSL,
            payload,
            'handshake',
            false,
            false,
        );
    }

    private async sendAuthComplete(): Promise<void> {
        const data = new AuthResponse({
            status: 0,
        });

        await this.sendPlainSpecificMessage(
            ControlMessageType.MESSAGE_AUTH_COMPLETE,
            data,
        );
    }

    private sendPingRequest(data: PingRequest): void {
        this.sendPingRequestAsync(data)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to send ping request', err);
            });
    }

    private async sendPingRequestAsync(data: PingRequest): Promise<void> {
        try {
            await this.sendPlainSpecificMessage(
                ControlMessageType.MESSAGE_PING_REQUEST,
                data,
            );
        } catch (err) {
            this.logger.error('Failed to send ping request', err);
        }
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

    private async sendServiceDiscoveryResponse(
        data: ServiceDiscoveryResponse,
    ): Promise<void> {
        this.logger.info('Service discovery', data.toJson());
        await this.sendEncryptedSpecificMessage(
            ControlMessageType.MESSAGE_SERVICE_DISCOVERY_RESPONSE,
            data,
        );
    }

    private async doVersionQuery(signal: AbortSignal): Promise<void> {
        await this.sendVersionRequest();
        const message = await this.waitForSpecificMessage(
            ControlMessageType.MESSAGE_VERSION_RESPONSE,
            signal,
        );
        const payload = message.getPayload();
        const reader = BufferReader.fromBuffer(payload);
        const majorCode = reader.readUint16BE();
        const mainorCode = reader.readUint16BE();
        const status = reader.readUint16BE() as MessageStatus;
        if (status === MessageStatus.STATUS_NO_COMPATIBLE_VERSION) {
            throw new Error('Mismatched verion');
        }

        this.logger.info(
            `Major: ${majorCode}, minor: ${mainorCode}, status: ${status}`,
        );
    }

    private async doHandshake(signal: AbortSignal): Promise<void> {
        this.logger.info('Start handshake');

        while (!this.cryptor.isHandshakeComplete()) {
            const sentPayload = await this.cryptor.readHandshakeBuffer();
            await this.sendHandshake(sentPayload);

            const message = await this.waitForSpecificMessage(
                ControlMessageType.MESSAGE_ENCAPSULATED_SSL,
                signal,
            );
            const receivedPayload = message.getPayload();
            await this.cryptor.writeHandshakeBuffer(receivedPayload);
        }

        await this.sendAuthComplete();

        this.logger.info('Finished handshake');
    }

    private async doServiceDiscovery(signal: AbortSignal): Promise<void> {
        const message = await this.waitForSpecificMessage(
            ControlMessageType.MESSAGE_SERVICE_DISCOVERY_REQUEST,
            signal,
        );
        const bufferPayload = message.getBufferPayload();

        const request = ServiceDiscoveryRequest.fromBinary(bufferPayload);
        this.printReceive(request);

        this.logger.info(
            `Discovery request, device name ${request.deviceName}`,
        );

        const response = this.events.getServiceDiscoveryResponse();
        await this.sendServiceDiscoveryResponse(response);
    }

    public override start(): void {
        super.start();
        this.pinger.start();
    }

    public async doStart(): Promise<void> {
        const abortSignal = AbortSignal.timeout(this.config.startTimeoutMs);

        await this.doVersionQuery(abortSignal);

        await this.doHandshake(abortSignal);

        await this.doServiceDiscovery(abortSignal);
    }

    public override stop(): void {
        this.pinger.stop();
        super.stop();
    }

    protected fillChannelDescriptor(_channelDescriptor: ProtoService): void {
        throw new Error('Control service does not support discovery');
    }
}
