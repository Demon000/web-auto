import { InputService, type ServiceEvents } from '@web-auto/android-auto';
import {
    ChannelOpenRequest,
    InputSourceService,
    InputSourceService_TouchScreen,
    KeyBindingRequest,
    Service,
} from '@web-auto/android-auto-proto';
import type {
    AndroidAutoInputService,
    AndroidAutoInputClient,
} from '@web-auto/android-auto-ipc';
import type { IpcServiceHandler } from '@web-auto/electron-ipc/common.js';
import type { PartialMessage } from '@bufbuild/protobuf';

export class ElectronAndroidAutoInputService extends InputService {
    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoInputService,
            AndroidAutoInputClient
        >,
        private touchScreenConfig: PartialMessage<InputSourceService_TouchScreen>,
        events: ServiceEvents,
    ) {
        super(events);

        this.ipcHandler.on('sendTouchEvent', this.sendTouchEvent.bind(this));
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {}
    protected async bind(_data: KeyBindingRequest): Promise<void> {}

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
