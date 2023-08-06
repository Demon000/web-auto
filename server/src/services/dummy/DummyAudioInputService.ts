import {
    AVChannelSetupRequest,
    AVInputOpenRequest,
    ChannelOpenRequest,
} from '@web-auto/protos/types';
import { AudioInputService } from '../AudioInputService';

export class DummyAudioInputService extends AudioInputService {
    protected async setup(_data: AVChannelSetupRequest): Promise<void> {
        // TOOD
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TOOD
    }

    protected async inputOpen(_data: AVInputOpenRequest): Promise<void> {
        // TOOD
    }
}
