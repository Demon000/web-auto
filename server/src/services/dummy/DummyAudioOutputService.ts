import {
    ChannelOpenRequest,
    AVChannelStartIndication,
    AVChannelSetupRequest,
    AVChannelStopIndication,
} from '@web-auto/protos/types';
import { DataBuffer } from '../..//utils/DataBuffer';
import { AudioOutputService } from '../AudioOutputService';

export class DummyAudioOutputService extends AudioOutputService {
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
