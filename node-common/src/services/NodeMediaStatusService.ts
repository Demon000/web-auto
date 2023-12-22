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
    private metadata?: MediaPlaybackMetadata;
    private status?: MediaPlaybackStatus;

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

    public stop(): void {
        super.stop();
        this.metadata = undefined;
        this.ipcHandler.metadata(undefined);
        this.status = undefined;
        this.ipcHandler.status(undefined);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async getMetadata(): Promise<MediaPlaybackMetadata | undefined> {
        return this.metadata;
    }

    protected async getStatus(): Promise<MediaPlaybackStatus | undefined> {
        return this.status;
    }

    protected async handleMetadata(data: MediaPlaybackMetadata): Promise<void> {
        this.metadata = data;
        this.ipcHandler.metadata({
            ...data,
        });
    }

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
