import {
    AVChannelSetupRequest,
    AVInputOpenRequest,
    ChannelOpenRequest,
} from '@web-auto/android-auto-proto';
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
        // TODO
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async inputOpen(_data: AVInputOpenRequest): Promise<void> {
        // TODO
    }
}
