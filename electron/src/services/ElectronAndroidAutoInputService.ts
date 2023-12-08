import { InputService, type ServiceEvents } from '@web-auto/android-auto';
import {
    ChannelOpenRequest,
    InputSourceService,
    KeyBindingRequest,
    Service,
    TouchEvent,
} from '@web-auto/android-auto-proto';
import type {
    AndroidAutoInputService,
    AndroidAutoInputClient,
} from '@web-auto/android-auto-ipc';
import type { IpcServiceHandler } from '@web-auto/electron-ipc/common.js';
import type {
    IInputSourceService_TouchScreen,
    ITouchEvent,
} from '@web-auto/android-auto-proto/interfaces.js';

export class ElectronAndroidAutoInputService extends InputService {
    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoInputService,
            AndroidAutoInputClient
        >,
        private touchScreenConfig: IInputSourceService_TouchScreen,
        events: ServiceEvents,
    ) {
        super(events);

        this.ipcHandler.on(
            'sendTouchEvent',
            this.sendTouchEventObject.bind(this),
        );
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {}
    protected async bind(_data: KeyBindingRequest): Promise<void> {}

    private async sendTouchEventObject(data: ITouchEvent): Promise<void> {
        await this.sendTouchEvent(new TouchEvent(data));
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.inputSourceService = new InputSourceService({
            keycodesSupported: [],
            touchscreen: [this.touchScreenConfig],
            touchpad: [],
            feedbackEventsSupported: [],
            displayId: 0,
        });
    }
}
