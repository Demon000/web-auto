import {
    AVChannelSetupRequest,
    AVInputOpenRequest,
    ChannelOpenRequest,
} from '@web-auto/protos/types';
import { AudioInputService } from '@/services/AudioInputService';
import { MessageInStream, MessageOutStream } from '@/messenger';

export class DummyAudioInputService extends AudioInputService {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(messageInStream, messageOutStream);
    }

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
