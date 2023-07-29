import { ChannelId } from '../messenger/ChannelId';
import { EncryptionType } from '../messenger/EncryptionType';
import { Message } from '../messenger/Message';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { MessageType } from '../messenger/MessageType';
import { Service } from './Service';
import { Cryptor } from '../ssl/Cryptor';
import { VersionResponseStatus_Enum } from '../proto/types/VersionResponseStatusEnum';
import { ServiceDiscoveryRequest } from '../proto/types/ServiceDiscoveryRequestMessage';
import { ControlMessage_Enum } from '../proto/types/ControlMessageIdsEnum';
import { AuthCompleteIndication } from '../proto/types/AuthCompleteIndicationMessage';
import { Status_Enum } from '../proto/types/StatusEnum';
import { DataBuffer } from '../utils/DataBuffer';

export class ControlService extends Service {
    public constructor(
        private cryptor: Cryptor,
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
        const message = new Message({
            messageId: ControlMessage_Enum.VERSION_REQUEST,
        });

        message.payload.appendUint16BE(1).appendUint16BE(1);

        return this.sendMessage(message, {
            encryptionType: EncryptionType.PLAIN,
            messageType: MessageType.SPECIFIC,
        });
    }

    private async sendHandshake(): Promise<void> {
        const payload = this.cryptor.readHandshakeBuffer();
        const message = new Message({
            messageId: ControlMessage_Enum.SSL_HANDSHAKE,
            dataPayload: payload,
        });

        return this.sendMessage(message, {
            encryptionType: EncryptionType.PLAIN,
            messageType: MessageType.SPECIFIC,
        });
    }

    public async sendAuthComplete(): Promise<void> {
        const data = AuthCompleteIndication.create({
            status: Status_Enum.OK,
        });

        const payload = DataBuffer.fromBuffer(
            AuthCompleteIndication.encode(data).finish(),
        );

        const message = new Message({
            messageId: ControlMessage_Enum.AUTH_COMPLETE,
            dataPayload: payload,
        });

        return this.sendMessage(message, {
            encryptionType: EncryptionType.PLAIN,
            messageType: MessageType.SPECIFIC,
        });
    }

    public async start(): Promise<void> {
        return this.sendVersionRequest();
    }
}
