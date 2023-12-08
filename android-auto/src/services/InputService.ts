import { Message } from '../messenger/Message.js';

import { Service, type ServiceEvents } from './Service.js';
import { microsecondsTime } from '../utils/time.js';
import {
    InputMessageId,
    InputReport,
    KeyBindingRequest,
    KeyBindingResponse,
    TouchEvent,
} from '@web-auto/android-auto-proto';

export abstract class InputService extends Service {
    public constructor(protected events: ServiceEvents) {
        super(events);
    }

    protected abstract bind(data: KeyBindingRequest): Promise<void>;

    protected async onBindingRequest(data: KeyBindingRequest): Promise<void> {
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
        let data;

        switch (message.messageId) {
            case InputMessageId.INPUT_MESSAGE_KEY_BINDING_REQUEST:
                data = KeyBindingRequest.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onBindingRequest(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
    }

    protected async sendBindingResponse(status: boolean): Promise<void> {
        const data = new KeyBindingResponse({
            status: status ? 0 : -1,
        });

        await this.sendEncryptedSpecificMessage(
            InputMessageId.INPUT_MESSAGE_KEY_BINDING_RESPONSE,
            data,
        );
    }

    protected async sendTouchEvent(touchEvent: TouchEvent): Promise<void> {
        if (!this.started) {
            return;
        }

        const data = new InputReport({
            timestamp: microsecondsTime(),
            touchEvent,
        });

        await this.sendEncryptedSpecificMessage(
            InputMessageId.INPUT_MESSAGE_INPUT_REPORT,
            data,
        );
    }
}
