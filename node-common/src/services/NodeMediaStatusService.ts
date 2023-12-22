import { MediaStatusService, type ServiceEvents } from '@web-auto/android-auto';
import type {
    AndroidAutoMediaStatusClient,
    AndroidAutoMediaStatusService,
} from '@web-auto/android-auto-ipc';
import {
    ChannelOpenRequest,
    MediaPlaybackMetadata,
    MediaPlaybackStatus,
    MediaPlaybackStatusService,
    Service,
} from '@web-auto/android-auto-proto';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';

export class NodeMediaStatusService extends MediaStatusService {
    private metadata: MediaPlaybackMetadata | undefined;
    private status: MediaPlaybackStatus | undefined;

    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoMediaStatusService,
            AndroidAutoMediaStatusClient
        >,
        events: ServiceEvents,
    ) {
        super(events);

        this.ipcHandler.on('getMetadata', this.getMetadata.bind(this));
        this.ipcHandler.on('getStatus', this.getStatus.bind(this));
    }

    public override stop(): void {
        super.stop();
        this.metadata = undefined;
        this.ipcHandler.metadata(undefined);
        this.status = undefined;
        this.ipcHandler.status(undefined);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async getMetadata(): Promise<MediaPlaybackMetadata | undefined> {
        return this.metadata;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async getStatus(): Promise<MediaPlaybackStatus | undefined> {
        return this.status;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async handleMetadata(data: MediaPlaybackMetadata): Promise<void> {
        this.metadata = data;
        this.ipcHandler.metadata({
            ...data,
        });
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async handlePlayback(data: MediaPlaybackStatus): Promise<void> {
        this.status = data;
        this.ipcHandler.status({
            ...data,
        });
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaPlaybackService = new MediaPlaybackStatusService(
            {},
        );
    }
}
