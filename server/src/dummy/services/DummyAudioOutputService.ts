import {
    AVChannelSetupRequest,
    AVChannelStartIndication,
    AVChannelStopIndication,
    ChannelOpenRequest,
} from '@web-auto/protos/types';
import { DataBuffer } from '@/utils/DataBuffer';
import { AudioOutputService } from '@/services/AudioOutputService';
import { ChannelId, MessageInStream, MessageOutStream } from '@/messenger';

export class DummyAudioOutputService extends AudioOutputService {
    public constructor(
        channelId: ChannelId,
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(channelId, messageInStream, messageOutStream);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TOOD
    }

    protected async channelStart(
        _data: AVChannelStartIndication,
    ): Promise<void> {
        // TOOD
    }

    protected async setup(_data: AVChannelSetupRequest): Promise<void> {
        // TOOD
    }

    protected async channelStop(_data: AVChannelStopIndication): Promise<void> {
        // TOOD
    }

    protected async handleData(
        _buffer: DataBuffer,
        _timestamp?: bigint | undefined,
    ): Promise<void> {
        // TODO
    }
}
