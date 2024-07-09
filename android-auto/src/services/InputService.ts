import { Service, type ServiceEvents } from './Service.js';
import { microsecondsTime } from '../utils/time.js';
import {
    InputMessageId,
    InputReport,
    KeyBindingRequest,
    KeyBindingResponse,
    KeyEvent,
    TouchEvent,
} from '@web-auto/android-auto-proto';

export abstract class InputService extends Service {
    public constructor(events: ServiceEvents) {
        super(events);

        this.addMessageCallback(
            InputMessageId.INPUT_MESSAGE_KEY_BINDING_REQUEST,
            this.onBindingRequest.bind(this),
            KeyBindingRequest,
        );
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

    protected sendBindingResponse(status: boolean): void {
        const data = new KeyBindingResponse({
            status: status ? 0 : -1,
        });

        this.sendEncryptedSpecificMessage(
            InputMessageId.INPUT_MESSAGE_KEY_BINDING_RESPONSE,
            data,
        );
    }

    protected sendTouchEvent(touchEvent: TouchEvent): void {
        if (!this.started) {
            return;
        }

        const data = new InputReport({
            timestamp: microsecondsTime(),
            touchEvent,
        });

        this.sendEncryptedSpecificMessage(
            InputMessageId.INPUT_MESSAGE_INPUT_REPORT,
            data,
        );
    }

    protected sendKeyEvent(keyEvent: KeyEvent): void {
        if (!this.started) {
            return;
        }

        const data = new InputReport({
            timestamp: microsecondsTime(),
            keyEvent,
        });

        this.sendEncryptedSpecificMessage(
            InputMessageId.INPUT_MESSAGE_INPUT_REPORT,
            data,
        );
    }
}
