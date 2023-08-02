import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { Service } from './Service';
import { Cryptor } from '../ssl/Cryptor';
import { DataBuffer } from '../utils/DataBuffer';
import { microsecondsTime } from '../utils/time';
import {
    AudioFocusType,
    AuthCompleteIndication,
    ChannelDescriptor,
    ChannelOpenRequest,
    ControlMessage,
    PingRequest,
    PingResponse,
    ServiceDiscoveryRequest,
    ServiceDiscoveryResponse,
    Status,
    VersionResponseStatus,
} from '../proto/types';
import Long from 'long';
import assert from 'assert';
import { AudioFocusRequest } from '../proto/types';
import { AudioFocusResponse } from '../proto/types';
import { AudioFocusState } from '../proto/types';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';

export class ControlService extends Service {
    private pingTimeout?: NodeJS.Timeout;

    public constructor(
        private cryptor: Cryptor,
        private services: Service[],
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

    public async onPingRequest(data: PingRequest): Promise<void> {
        assert(data.timestamp instanceof Long);
        await this.sendPingResponse(data.timestamp);
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
        console.log(
            `Discovery request, brand: ${data.deviceBrand}, device name ${data.deviceName}`,
        );

        return this.sendDiscoveryResponse(this.services);
    }

    private async onAudioFocusRequest(data: AudioFocusRequest): Promise<void> {
        return this.sendAudioFocusResponse(data.audioFocusType);
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
            case ControlMessage.Enum.PING_REQUEST:
                data = PingRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onPingRequest(data);
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
            default:
                await super.onMessage(message, options);
        }
    }

    private async sendVersionRequest(): Promise<void> {
        const payload = DataBuffer.fromSize(4)
            .appendUint16BE(1)
            .appendUint16BE(1);

        return this.sendPlainSpecificMessage(
            ControlMessage.Enum.VERSION_REQUEST,
            payload,
        );
    }

    private async sendHandshake(): Promise<void> {
        const payload = this.cryptor.readHandshakeBuffer();

        return this.sendPlainSpecificMessage(
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

        return this.sendPlainSpecificMessage(
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

        return this.sendPlainSpecificMessage(
            ControlMessage.Enum.PING_REQUEST,
            payload,
        );
    }

    private async sendAudioFocusResponse(
        audioFocusType: AudioFocusType.Enum,
    ): Promise<void> {
        const data = AudioFocusResponse.create({
            audioFocusState:
                audioFocusType === AudioFocusType.Enum.RELEASE
                    ? AudioFocusState.Enum.LOSS
                    : AudioFocusState.Enum.GAIN,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            AudioFocusResponse.encode(data).finish(),
        );

        return this.sendEncryptedSpecificMessage(
            ControlMessage.Enum.AUDIO_FOCUS_RESPONSE,
            payload,
        );
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

    public async sendDiscoveryResponse(services: Service[]): Promise<void> {
        const data = ServiceDiscoveryResponse.create({
            headUnitName: 'OpenAuto',
            carModel: 'Universal',
            carYear: '2018',
            carSerial: '20180301',
            leftHandDriveVehicle: false,
            headunitManufacturer: 'f1x',
            headunitModel: 'OpenAuto Autoapp',
            swBuild: '1',
            swVersion: '1.0',
            canPlayNativeMediaDuringVr: false,
            hideClock: false,
        });

        for (const service of services) {
            service.fillFeatures(data);
        }

        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            ServiceDiscoveryResponse.encode(data).finish(),
        );

        return this.sendEncryptedSpecificMessage(
            ControlMessage.Enum.SERVICE_DISCOVERY_RESPONSE,
            payload,
        );
    }

    public async start(): Promise<void> {
        this.schedulePing();
        return this.sendVersionRequest();
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
