import { InputService, type ServiceEvents } from '@web-auto/android-auto';
import {
    InputSourceService,
    InputSourceService_TouchScreen,
    KeyBindingRequest,
    KeyCode,
    KeyEvent,
    Service,
    TouchEvent,
} from '@web-auto/android-auto-proto';
import type {
    AndroidAutoInputService,
    AndroidAutoInputClient,
} from '@web-auto/android-auto-ipc';
import type {
    IInputSourceService_TouchScreen,
    IKeyEvent,
    ITouchEvent,
} from '@web-auto/android-auto-proto/interfaces.js';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';

export class NodeAutoInputService extends InputService {
    public constructor(
        private ipcHandler:
            | IpcServiceHandler<AndroidAutoInputService, AndroidAutoInputClient>
            | undefined,
        private touchScreenConfig: IInputSourceService_TouchScreen | undefined,
        private displayId: number,
        events: ServiceEvents,
    ) {
        super(events);

        if (this.ipcHandler === undefined) {
            return;
        }

        this.ipcHandler.on(
            'sendTouchEvent',
            this.sendTouchEventObject.bind(this),
        );
        this.ipcHandler.on('sendKeyEvent', this.sendKeyEventObject.bind(this));
    }

    protected async bind(_data: KeyBindingRequest): Promise<void> {}

    private async sendTouchEventObject(data: ITouchEvent): Promise<void> {
        await this.sendTouchEvent(new TouchEvent(data));
    }

    private async sendKeyEventObject(data: IKeyEvent): Promise<void> {
        await this.sendKeyEvent(new KeyEvent(data));
    }

    protected fillKeycodes(inputSourceService: InputSourceService): void {
        for (const keyCode of Object.values(KeyCode)) {
            if (typeof keyCode === 'number') {
                inputSourceService.keycodesSupported.push(keyCode);
            }
        }
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.inputSourceService = new InputSourceService({
            keycodesSupported: [],
            touchscreen: [],
            touchpad: [],
            feedbackEventsSupported: [],
            displayId: this.displayId,
        });

        if (this.touchScreenConfig !== undefined) {
            channelDescriptor.inputSourceService.touchscreen.push(
                new InputSourceService_TouchScreen(this.touchScreenConfig),
            );
        }

        this.fillKeycodes(channelDescriptor.inputSourceService);
    }
}
