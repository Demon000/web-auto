import { NavigationStatusService } from '@web-auto/android-auto';
import {
    NavigationCurrentPosition,
    NavigationNextTurnDistanceEvent,
    NavigationNextTurnEvent,
    NavigationState,
    NavigationStatus,
    NavigationStatusService as NavigationStatusServiceProto,
    NavigationStatusService_InstrumentClusterType,
    Service,
} from '@web-auto/android-auto-proto';

export class NodeNavigationStatusService extends NavigationStatusService {
    protected async handleCurrentPosition(
        _data: NavigationCurrentPosition,
    ): Promise<void> {
        // TODO
    }

    protected async handleState(_data: NavigationState): Promise<void> {
        // TODO
    }

    protected async handleStatus(_data: NavigationStatus): Promise<void> {
        // TODO
    }

    protected async handleDistance(
        _data: NavigationNextTurnDistanceEvent,
    ): Promise<void> {
        // TODO
    }

    protected async handleTurn(_data: NavigationNextTurnEvent): Promise<void> {
        // TODO
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.navigationStatusService =
            new NavigationStatusServiceProto({
                minimumIntervalMs: 1000,
                type: NavigationStatusService_InstrumentClusterType.IMAGE,
                imageOptions: {
                    width: 256,
                    height: 256,
                    colourDepthBits: 16,
                },
            });
    }
}
