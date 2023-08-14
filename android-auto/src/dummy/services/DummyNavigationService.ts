import {
    ChannelDescriptor,
    ChannelOpenRequest,
    NavigationDistanceEvent,
    NavigationStatus,
    NavigationTurnEvent,
    NavigationTurnType,
} from '@web-auto/android-auto-proto';
import { NavigationStatusService } from '@/services/NavigationStatusService';
import { MessageInStream, MessageOutStream } from '@/messenger';

export class DummyNavigationStatusService extends NavigationStatusService {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(messageInStream, messageOutStream);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async handleStatus(_data: NavigationStatus): Promise<void> {
        // TODO
    }

    protected async handleDistance(
        _data: NavigationDistanceEvent,
    ): Promise<void> {
        // TODO
    }

    protected async handleTurn(_data: NavigationTurnEvent): Promise<void> {
        // TODO
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.navigationChannel = {
            minimumIntervalMs: 1000,
            type: NavigationTurnType.Enum.IMAGE,
            imageOptions: {
                width: 256,
                height: 256,
                colourDepthBits: 16,
                dunno: 256,
            },
        };
    }
}
