import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { Service } from './Service';
import { Cryptor } from '../ssl/Cryptor';
import { DataBuffer } from '../utils/DataBuffer';
import { microsecondsTime } from '../utils/time';
import {
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
        console.log('Send ping request');
        await this.sendPingRequest();
        this.schedulePing();
    }

    public async onPingRequest(message: Message): Promise<void> {
        const data = PingRequest.decode(message.getBufferPayload());
        assert(data.timestamp instanceof Long);
        console.log('Receive ping request');
        await this.sendPingResponse(data.timestamp);
    }

    public async onPingResponse(_message: Message): Promise<void> {
        console.log('Receive ping response');
    }

    private async onVersionReponse(message: Message): Promise<void> {
        const majorCode = message.payload.readUint16BE();
        const mainorCode = message.payload.readUint16BE();
        const status = message.payload.readUint16BE();
        if (status === VersionResponseStatus.Enum.MISMATCH) {
            throw new Error('Mismatched verion');
        }

        console.log(
            `Major: ${majorCode}, minor: ${mainorCode}, status: ${status}`,
        );

        this.cryptor.doHandshake();

        await this.sendHandshake();
    }

    private async onHandshake(message: Message): Promise<void> {
        this.cryptor.writeHandshakeBuffer(message.getPayload());

        if (this.cryptor.doHandshake()) {
            console.log('Auth completed');

            await this.sendAuthComplete();
        } else {
            console.log('Continue handshake');

            await this.sendHandshake();
        }
    }

    private async onServiceDiscoveryRequest(message: Message): Promise<void> {
        const data = ServiceDiscoveryRequest.decode(message.getBufferPayload());

        console.log(
            `Discovery request, brand: ${data.deviceBrand}, device name ${data.deviceName}`,
        );

        return this.sendDiscoveryResponse(this.services);
    }

    protected onMessage(message: Message): boolean {
        switch (message.messageId as ControlMessage.Enum) {
            case ControlMessage.Enum.VERSION_RESPONSE:
                this.onVersionReponse(message);
                break;
            case ControlMessage.Enum.SSL_HANDSHAKE:
                this.onHandshake(message);
                break;
            case ControlMessage.Enum.SERVICE_DISCOVERY_REQUEST:
                this.onServiceDiscoveryRequest(message);
                break;
            case ControlMessage.Enum.PING_REQUEST:
                this.onPingRequest(message);
                break;
            case ControlMessage.Enum.PING_RESPONSE:
                this.onPingResponse(message);
                break;
            default:
                return false;
        }

        return true;
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

        const payload = DataBuffer.fromBuffer(
            PingRequest.encode(data).finish(),
        );

        return this.sendPlainSpecificMessage(
            ControlMessage.Enum.PING_REQUEST,
            payload,
        );
    }

    private async sendPingResponse(timestamp: Long): Promise<void> {
        const data = PingResponse.create({
            timestamp,
        });

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
            headUnitName: 'WebAuto',
            carModel: 'Universal',
            carYear: '2023',
            carSerial: '20230731',
            leftHandDriveVehicle: false,
            headunitManufacturer: 'WebAuto',
            headunitModel: 'WebAuto',
            swBuild: '1',
            swVersion: '1.0',
            canPlayNativeMediaDuringVr: false,
            hideClock: false,
        });

        for (const service of services) {
            service.fillFeatures(data);
        }

        console.log(ServiceDiscoveryResponse.toObject(data));

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

    protected openChannel(_data: ChannelOpenRequest): Promise<void> {
        throw new Error('Control service does not support openning channel');
    }
}
