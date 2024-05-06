import {
    AudioInputService,
    type AudioInputServiceConfig,
    type ServiceEvents,
} from '@web-auto/android-auto';
import { MicrophoneRequest } from '@web-auto/android-auto-proto';

export interface NodeAudioInputServiceConfig extends AudioInputServiceConfig {}

export class NodeAudioInputService extends AudioInputService {
    public constructor(
        protected override config: NodeAudioInputServiceConfig,
        events: ServiceEvents,
    ) {
        super(config, events);

        this.session = 0;
    }

    protected inputOpen(_data: MicrophoneRequest): void {}
}
