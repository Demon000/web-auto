import {
    AVChannelSetupRequest,
    AVChannelStartIndication,
    AVChannelStopIndication,
    ChannelOpenRequest,
} from '@web-auto/android-auto-proto';
import { DataBuffer } from '@/utils/DataBuffer';
import { AudioOutputService } from '@/services/AudioOutputService';
import { ChannelId } from '@/messenger';
import Long from 'long';

export class DummyAudioOutputService extends AudioOutputService {
    public constructor(channelId: ChannelId) {
        super(channelId);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async channelStart(
        _data: AVChannelStartIndication,
    ): Promise<void> {
        // TODO
    }

    protected async setup(_data: AVChannelSetupRequest): Promise<void> {
        // TODO
    }

    protected async channelStop(_data: AVChannelStopIndication): Promise<void> {
        // TODO
    }

    protected async handleData(
        _buffer: DataBuffer,
        _timestamp?: Long,
    ): Promise<void> {
        // TODO
    }
}
