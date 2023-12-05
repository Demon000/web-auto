import { InputService, type ServiceEvents } from '@web-auto/android-auto';
import {
    ChannelOpenRequest,
    BindingRequest,
    ChannelDescriptor,
    InputChannel,
    type ITouchConfig,
} from '@web-auto/android-auto-proto';
import type {
    AndroidAutoInputService,
    AndroidAutoInputClient,
} from '@web-auto/android-auto-ipc';
import type { IpcServiceHandler } from '@web-auto/electron-ipc/common.js';

export class ElectronAndroidAutoInputService extends InputService {
    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoInputService,
            AndroidAutoInputClient
        >,
        private touchScreenConfig: ITouchConfig,
        events: ServiceEvents,
    ) {
        super(events);

        this.ipcHandler.on('sendTouchEvent', this.sendTouchEvent.bind(this));
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {}
    protected async bind(_data: BindingRequest): Promise<void> {}

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.inputChannel = InputChannel.create({
            supportedKeycodes: [],
            touchScreenConfig: this.touchScreenConfig,
        });
    }
}
