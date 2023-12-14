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
import type { IpcServiceHandler } from '@web-auto/common-ipc';

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

    public async start(): Promise<void> {
        await super.start();
    }

    public async stop(): Promise<void> {
        await super.stop();
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
