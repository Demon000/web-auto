import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { InputChannelMessage, Status } from '@web-auto/protos/types';
import { BindingRequest } from '@web-auto/protos/types';
import { BindingResponse } from '@web-auto/protos/types';
import { InputChannel } from '@web-auto/protos/types';
import { ChannelOpenRequest, ChannelDescriptor } from '@web-auto/protos/types';
import { DataBuffer } from '../utils/DataBuffer';
import { Service } from './Service';

export abstract class InputService extends Service {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.INPUT, messageInStream, messageOutStream);
    }

    protected abstract open(data: ChannelOpenRequest): Promise<void>;
    protected abstract bind(data: BindingRequest): Promise<void>;

    protected async onBindingRequest(data: BindingRequest): Promise<void> {
        let status = false;

        try {
            await this.bind(data);
            status = true;
        } catch (e) {
            console.log(e);
        }

        return this.sendBindingResponse(status);
    }

    protected async onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data: BindingRequest;

        switch (message.messageId) {
            case InputChannelMessage.Enum.BINDING_REQUEST:
                data = BindingRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onBindingRequest(data);
                break;
            default:
                await super.onMessage(message, options);
        }
    }

    protected async sendBindingResponse(status: boolean): Promise<void> {
        const data = BindingResponse.create({
            status: status ? Status.Enum.OK : Status.Enum.FAIL,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            BindingResponse.encode(data).finish(),
        );

        await this.sendEncryptedSpecificMessage(
            InputChannelMessage.Enum.BINDING_RESPONSE,
            payload,
        );
    }
}
