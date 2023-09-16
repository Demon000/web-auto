import {
    BindingRequest,
    ChannelDescriptor,
    ChannelOpenRequest,
    InputChannel,
} from '@web-auto/android-auto-proto';
import { InputService } from '@/services/InputService';

export class DummyInputService extends InputService {
    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async bind(_data: BindingRequest): Promise<void> {
        // TODO
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.inputChannel = InputChannel.create({
            supportedKeycodes: [],
            touchScreenConfig: {
                width: 1920,
                height: 1080,
            },
        });
    }
}
