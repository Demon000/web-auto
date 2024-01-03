import { InputService } from '@web-auto/android-auto';
import {
    type KeyBindingRequest,
    type Service,
    InputSourceService,
} from '@web-auto/android-auto-proto';

export class NodeClusterInputService extends InputService {
    protected override async bind(_data: KeyBindingRequest): Promise<void> {
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
