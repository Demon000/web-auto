import assert from 'node:assert';

import {
    AudioFocusNotification,
    AudioFocusRequestNotification,
    AudioFocusRequestType,
    AudioFocusStateType,
    AuthResponse,
    BatteryStatusNotification,
    ByeByeRequest,
    ControlMessageType,
    GalConstants,
    MessageStatus,
    NavFocusNotification,
    NavFocusRequestNotification,
    NavFocusType,
    PingRequest,
    PingResponse,
    ServiceDiscoveryRequest,
    ServiceDiscoveryResponse,
    VoiceSessionNotification,
} from '@web-auto/android-auto-proto';
import type {
    IHeadUnitInfo,
    IServiceDiscoveryResponse,
} from '@web-auto/android-auto-proto/interfaces.js';

import type { Cryptor } from '../crypto/Cryptor.js';
import {
    type DeviceDisconnectReason,
    GenericDeviceDisconnectReason,
} from '../transport/Device.js';
import { BufferReader, BufferWriter } from '../utils/buffer.js';
import { Pinger } from './Pinger.js';
import { Service, type ServiceEvents } from './Service.js';

export interface ControlServiceEvents extends ServiceEvents {
    onSelfDisconnect: (reason: DeviceDisconnectReason) => void;
}

export interface ControlServiceConfig {
    pingTimeoutMs: number;
    startTimeoutMs: number;
    headunitInfo: IHeadUnitInfo;
    serviceDiscoveryResponse: Omit<IServiceDiscoveryResponse, 'services'>;
}

export class ControlService extends Service {
    private pinger;

    public constructor(
        private cryptor: Cryptor,
        private config: ControlServiceConfig,
        protected override events: ControlServiceEvents,
    ) {
        super(events, 0);

        this.pinger = new Pinger(config.pingTimeoutMs, {
            onPingTimeout: this.onPingTimeout.bind(this),
            onPingRequest: this.sendPingRequest.bind(this),
        });

        this.addMessageCallback(
            ControlMessageType.MESSAGE_PING_REQUEST,
            this.onPingRequest.bind(this),
            PingRequest,
        );
        this.addMessageCallback(
            ControlMessageType.MESSAGE_PING_RESPONSE,
            this.onPingResponse.bind(this),
            PingResponse,
        );
        this.addMessageCallback(
            ControlMessageType.MESSAGE_AUDIO_FOCUS_REQUEST,
            this.onAudioFocusRequest.bind(this),
            AudioFocusRequestNotification,
        );
        this.addMessageCallback(
            ControlMessageType.MESSAGE_NAV_FOCUS_REQUEST,
            this.onNavigationFocusRequest.bind(this),
            NavFocusRequestNotification,
        );
        this.addMessageCallback(
            ControlMessageType.MESSAGE_VOICE_SESSION_NOTIFICATION,
            this.onVoiceSessionNotification.bind(this),
            VoiceSessionNotification,
        );
        this.addMessageCallback(
            ControlMessageType.MESSAGE_BATTERY_STATUS_NOTIFICATION,
            this.onBatteryStatusNotification.bind(this),
            BatteryStatusNotification,
        );
        this.addMessageCallback(
            ControlMessageType.MESSAGE_BYEBYE_REQUEST,
            this.onByeByeRequest.bind(this),
            ByeByeRequest,
        );
    }

    private onPingTimeout(): void {
        this.events.onSelfDisconnect(
            GenericDeviceDisconnectReason.PING_TIMEOUT,
        );
    }

    private onByeByeRequest(_data: ByeByeRequest): void {
        this.events.onSelfDisconnect(GenericDeviceDisconnectReason.BYE_BYE);
    }

    private onPingRequest(data: PingRequest): void {
        assert(data.timestamp !== undefined);
        this.sendPingResponse(data.timestamp);
    }

    private onPingResponse(data: PingResponse): void {
        this.pinger.onPingResponse(data);
    }

    private onAudioFocusRequest(data: AudioFocusRequestNotification): void {
        const audioFocusState =
            data.request === AudioFocusRequestType.AUDIO_FOCUS_RELEASE
                ? AudioFocusStateType.AUDIO_FOCUS_STATE_LOSS
                : AudioFocusStateType.AUDIO_FOCUS_STATE_GAIN;

        this.sendAudioFocusResponse(audioFocusState);
    }

    private onNavigationFocusRequest(data: NavFocusRequestNotification): void {
        if (data.focusType === undefined) {
            return;
        }

        this.sendNavigationFocusResponse(data.focusType);
    }

    protected onVoiceSessionNotification(
        _data: VoiceSessionNotification,
    ): void {}

    protected onBatteryStatusNotification(
        _data: BatteryStatusNotification,
    ): void {}

    private sendPingResponse(timestamp: bigint): void {
        const data = new PingResponse({
            timestamp,
            data: new Uint8Array(),
        });

        this.sendPlainSpecificMessage(
            ControlMessageType.MESSAGE_PING_RESPONSE,
            data,
        );
    }

    private sendVersionRequest(): void {
        const writer = BufferWriter.fromSize(4);

        writer.appendUint16BE(GalConstants.PROTOCOL_MAJOR_VERSION);
        writer.appendUint16BE(GalConstants.PROTOCOL_MINOR_VERSION);

        this.sendPayloadWithId(
            ControlMessageType.MESSAGE_VERSION_REQUEST,
            writer.data,
            'Version Request',
            false,
            false,
        );
    }

    private sendHandshake(payload: Uint8Array): void {
        this.sendPayloadWithId(
            ControlMessageType.MESSAGE_ENCAPSULATED_SSL,
            payload,
            'Handshake',
            false,
            false,
        );
    }

    private sendAuthComplete(): void {
        const data = new AuthResponse({
            status: 0,
        });

        this.sendPlainSpecificMessage(
            ControlMessageType.MESSAGE_AUTH_COMPLETE,
            data,
        );
    }

    private sendPingRequest(data: PingRequest): void {
        this.sendPlainSpecificMessage(
            ControlMessageType.MESSAGE_PING_REQUEST,
            data,
        );
    }

    private sendAudioFocusResponse(focusState: AudioFocusStateType): void {
        const data = new AudioFocusNotification({
            focusState,
            unsolicited: false,
        });

        this.sendEncryptedSpecificMessage(
            ControlMessageType.MESSAGE_AUDIO_FOCUS_NOTIFICATION,
            data,
        );
    }

    private sendNavigationFocusResponse(focusType: NavFocusType): void {
        const data = new NavFocusNotification({
            focusType,
        });

        this.sendEncryptedSpecificMessage(
            ControlMessageType.MESSAGE_NAV_FOCUS_NOTIFICATION,
            data,
        );
    }

    private sendServiceDiscoveryResponse(data: ServiceDiscoveryResponse): void {
        this.logger.info('Service discovery', data.toJson());
        this.sendEncryptedSpecificMessage(
            ControlMessageType.MESSAGE_SERVICE_DISCOVERY_RESPONSE,
            data,
        );
    }

    private async doVersionQuery(signal: AbortSignal): Promise<void> {
        this.sendVersionRequest();
        const payload = await this.waitForSpecificMessage(
            ControlMessageType.MESSAGE_VERSION_RESPONSE,
            signal,
        );

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
            this.sendHandshake(sentPayload);

            const receivedPayload = await this.waitForSpecificMessage(
                ControlMessageType.MESSAGE_ENCAPSULATED_SSL,
                signal,
            );
            await this.cryptor.writeHandshakeBuffer(receivedPayload);
        }

        this.sendAuthComplete();

        this.logger.info('Finished handshake');
    }

    public buildServiceDiscoveryResponse(
        services: Service[],
    ): ServiceDiscoveryResponse {
        const data = new ServiceDiscoveryResponse({
            ...this.config.serviceDiscoveryResponse,
            headunitInfo: this.config.headunitInfo,
            services: [],
        });

        for (const service of services) {
            service.fillFeatures(data);
        }

        return data;
    }

    private async doServiceDiscovery(
        signal: AbortSignal,
        serviceDiscoveryResponse: ServiceDiscoveryResponse,
    ): Promise<void> {
        const request = await this.waitForSpecificMessage(
            ControlMessageType.MESSAGE_SERVICE_DISCOVERY_REQUEST,
            signal,
            ServiceDiscoveryRequest,
        );

        this.logger.info(
            `Discovery request, device name ${request.deviceName}`,
        );

        this.sendServiceDiscoveryResponse(serviceDiscoveryResponse);
    }

    public override start(): void {
        super.start();
        this.pinger.start();
    }

    public async doStart(services: Service[]): Promise<void> {
        const abortSignal = AbortSignal.timeout(this.config.startTimeoutMs);

        await this.doVersionQuery(abortSignal);

        await this.doHandshake(abortSignal);

        const serviceDiscoveryResponse =
            this.buildServiceDiscoveryResponse(services);

        await this.doServiceDiscovery(abortSignal, serviceDiscoveryResponse);
    }

    public override stop(): void {
        this.pinger.stop();
        super.stop();
    }
}
