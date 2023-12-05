import {
    BindingRequest,
    BindingResponse,
    type ITouchEvent,
    InputChannelMessage,
    InputEventIndication,
    Status,
} from '@web-auto/android-auto-proto';

import { Message } from '../messenger/Message.js';
import { DataBuffer } from '../utils/DataBuffer.js';

import { Service, type ServiceEvents } from './Service.js';
import { microsecondsTime } from '../utils/time.js';

export abstract class InputService extends Service {
    public constructor(protected events: ServiceEvents) {
        super(events);
    }

    protected abstract bind(data: BindingRequest): Promise<void>;

    protected async onBindingRequest(data: BindingRequest): Promise<void> {
        let status = false;

        try {
            await this.bind(data);
            status = true;
        } catch (err) {
            this.logger.error('Failed to bind', {
                data,
                err,
            });
            return;
        }

        return this.sendBindingResponse(status);
    }

    public async onSpecificMessage(message: Message): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data: BindingRequest;

        switch (message.messageId) {
            case InputChannelMessage.Enum.BINDING_REQUEST:
                data = BindingRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onBindingRequest(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
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

    public async sendTouchEvent(touchEvent: ITouchEvent): Promise<void> {
        if (!this.started) {
            return;
        }

        const data = InputEventIndication.create({
            timestamp: microsecondsTime(),
            touchEvent,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            InputEventIndication.encode(data).finish(),
        );

        await this.sendEncryptedSpecificMessage(
            InputChannelMessage.Enum.INPUT_EVENT_INDICATION,
            payload,
        );
    }
}
