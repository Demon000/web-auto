import { ChannelId } from '../messenger/ChannelId';
import { EncryptionType } from '../messenger/EncryptionType';
import { Message } from '../messenger/Message';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { MessageType } from '../messenger/MessageType';
import { Service } from './Service';
import {
    createDecodedType,
    createEncodedType,
    lookupEnum,
    lookupType,
} from '../proto/proto';
import { Cryptor } from '../ssl/Cryptor';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';

export class ControlService extends Service {
    public constructor(
        private cryptor: Cryptor,
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.CONTROL, messageInStream, messageOutStream);
    }

    private async onVersionReponse(message: Message): Promise<void> {
        const VersionResponseStatus = lookupEnum('VersionResponseStatus');
        const majorCode = message.payload.readUint16BE();
        const mainorCode = message.payload.readUint16BE();
        const status = message.payload.readUint16BE();
        if (status === VersionResponseStatus.values.MISMATCH) {
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
        const ServiceDiscoveryRequest = lookupType('ServiceDiscoveryRequest');

        const data = createDecodedType(
            ServiceDiscoveryRequest,
            message.getPayload(),
        );
        console.log(JSON.stringify(data));
    }

    protected onMessage(message: Message, options: MessageFrameOptions): void {
        const ControlMessage = lookupEnum('ControlMessage');

        switch (message.messageId) {
            case ControlMessage.values.VERSION_RESPONSE:
                this.onVersionReponse(message);
                break;
            case ControlMessage.values.SSL_HANDSHAKE:
                this.onHandshake(message);
                break;
            case ControlMessage.values.SERVICE_DISCOVERY_REQUEST:
                this.onServiceDiscoveryRequest(message);
                break;
            default:
                console.log(
                    `Unhandled message with id ${message.messageId}`,
                    message.getPayload(),
                    options,
                );
        }
    }

    private async sendVersionRequest(): Promise<void> {
        const ControlMessage = lookupEnum('ControlMessage');

        const message = new Message({
            messageId: ControlMessage.values.VERSION_REQUEST,
        });

        message.payload.appendUint16BE(1).appendUint16BE(1);

        return this.sendMessage(message, {
            encryptionType: EncryptionType.PLAIN,
            messageType: MessageType.SPECIFIC,
        });
    }

    private async sendHandshake(): Promise<void> {
        const ControlMessage = lookupEnum('ControlMessage');

        const payload = this.cryptor.readHandshakeBuffer();
        const message = new Message({
            messageId: ControlMessage.values.SSL_HANDSHAKE,
            dataPayload: payload,
        });

        return this.sendMessage(message, {
            encryptionType: EncryptionType.PLAIN,
            messageType: MessageType.SPECIFIC,
        });
    }

    public async sendAuthComplete(): Promise<void> {
        const AuthCompleteIndication = lookupType('AuthCompleteIndication');
        const ControlMessage = lookupEnum('ControlMessage');
        const Status = lookupEnum('Status');

        const payload = createEncodedType(AuthCompleteIndication, {
            status: Status.values.OK,
        });

        const message = new Message({
            messageId: ControlMessage.values.AUTH_COMPLETE,
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
