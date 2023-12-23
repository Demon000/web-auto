import {
    DisplayType,
    MediaSinkService,
    type Service,
} from '@web-auto/android-auto-proto';
import { NodeVideoService } from './NodeVideoService.js';

export class NodeClusterVideoService extends NodeVideoService {
    protected override fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaSinkService = new MediaSinkService({
            videoConfigs: this.videoConfigs,
            displayId: 1,
            displayType: DisplayType.CLUSTER,
        });
    }
}
