import { MediaStatusService, type ServiceEvents } from '@web-auto/android-auto';
import type {
    AndroidAutoMediaStatusClient,
    AndroidAutoMediaStatusService,
} from '@web-auto/android-auto-ipc';
import {
    MediaPlaybackMetadata,
    MediaPlaybackStatus,
    MediaPlaybackStatusService,
    Service,
} from '@web-auto/android-auto-proto';
import type {
    IMediaPlaybackMetadata,
    IMediaPlaybackStatus,
} from '@web-auto/android-auto-proto/interfaces.js';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';

export class NodeMediaStatusService extends MediaStatusService {
    private metadata: IMediaPlaybackMetadata | undefined;
    private status: IMediaPlaybackStatus | undefined;

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

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async getMetadata(): Promise<IMediaPlaybackMetadata | undefined> {
        return this.metadata;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async getStatus(): Promise<IMediaPlaybackStatus | undefined> {
        return this.status;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async handleMetadata(data: MediaPlaybackMetadata): Promise<void> {
        this.metadata = {
            ...data,
        };
        this.ipcHandler.metadata(this.metadata);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async handlePlayback(data: MediaPlaybackStatus): Promise<void> {
        this.status = {
            ...data,
        };
        this.ipcHandler.status(this.status);
    }

    protected fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.mediaPlaybackService = new MediaPlaybackStatusService(
            {},
        );
    }
}
