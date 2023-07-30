import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { Service } from './Service';
import { Cryptor } from '../ssl/Cryptor';
import { VersionResponseStatus_Enum } from '../proto/types/VersionResponseStatusEnum';
import { ServiceDiscoveryRequest } from '../proto/types/ServiceDiscoveryRequestMessage';
import { ControlMessage_Enum } from '../proto/types/ControlMessageIdsEnum';
import { AuthCompleteIndication } from '../proto/types/AuthCompleteIndicationMessage';
import { Status_Enum } from '../proto/types/StatusEnum';
import { DataBuffer } from '../utils/DataBuffer';
import { ChannelDescriptor } from '../proto/types/ChannelDescriptorData';
import { ChannelOpenRequest } from '../proto/types/ChannelOpenRequestMessage';
import { ServiceDiscoveryResponse } from '../proto/types/ServiceDiscoveryResponseMessage';

export class ControlService extends Service {
    public constructor(
        private cryptor: Cryptor,
        private services: Service[],
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.CONTROL, messageInStream, messageOutStream);
    }

    private async onVersionReponse(message: Message): Promise<void> {
        const majorCode = message.payload.readUint16BE();
        const mainorCode = message.payload.readUint16BE();
        const status = message.payload.readUint16BE();
        if (status === VersionResponseStatus_Enum.MISMATCH) {
            throw new Error('Mismatched verion');
        }

        console.log(
            `Major: ${majorCode}, minor: ${mainorCode}, status: ${status}`,
        );

        this.cryptor.doHandshake();

        await this.sendHandshake();
    }

    private async onHandshake(message: Message): Promise<void> {
        this.cryptor.writeHandshakeBuffer(message.getPayload().data);

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
        switch (message.messageId as ControlMessage_Enum) {
            case ControlMessage_Enum.VERSION_RESPONSE:
                this.onVersionReponse(message);
                break;
            case ControlMessage_Enum.SSL_HANDSHAKE:
                this.onHandshake(message);
                break;
            case ControlMessage_Enum.SERVICE_DISCOVERY_REQUEST:
                this.onServiceDiscoveryRequest(message);
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
            ControlMessage_Enum.VERSION_REQUEST,
            payload,
        );
    }

    private async sendHandshake(): Promise<void> {
        const buffer = this.cryptor.readHandshakeBuffer();
        const payload = DataBuffer.fromBuffer(buffer);

        return this.sendPlainSpecificMessage(
            ControlMessage_Enum.SSL_HANDSHAKE,
            payload,
        );
    }

    public async sendAuthComplete(): Promise<void> {
        const data = AuthCompleteIndication.create({
            status: Status_Enum.OK,
        });

        const payload = DataBuffer.fromBuffer(
            AuthCompleteIndication.encode(data).finish(),
        );

        return this.sendPlainSpecificMessage(
            ControlMessage_Enum.AUTH_COMPLETE,
            payload,
        );
    }

    public async sendDiscoveryResponse(services: Service[]): Promise<void> {
        const data = ServiceDiscoveryResponse.create();

        for (const service of services) {
            service.fillFeatures(data);
        }

        console.log(ServiceDiscoveryResponse.toJSON(data));

        const payload = DataBuffer.fromBuffer(
            ServiceDiscoveryResponse.encode(data).finish(),
        );

        return this.sendEncryptedSpecificMessage(
            ControlMessage_Enum.SERVICE_DISCOVERY_RESPONSE,
            payload,
        );
    }

    public async start(): Promise<void> {
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
