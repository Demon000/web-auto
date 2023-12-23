import { InputService } from '@web-auto/android-auto';
import {
    type KeyBindingRequest,
    type ChannelOpenRequest,
    type Service,
    InputSourceService,
} from '@web-auto/android-auto-proto';

export class NodeClusterInputService extends InputService {
    protected override async bind(_data: KeyBindingRequest): Promise<void> {
        // TODO
    }

    protected override async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected override fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.inputSourceService = new InputSourceService({
            keycodesSupported: [],
            touchscreen: [],
            touchpad: [],
            feedbackEventsSupported: [],
            displayId: 1,
        });
    }
}
