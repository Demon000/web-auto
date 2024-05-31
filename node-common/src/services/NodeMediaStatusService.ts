import { MediaStatusService, type ServiceEvents } from '@web-auto/android-auto';
import {
    MediaPlaybackMetadata,
    MediaPlaybackStatus,
} from '@web-auto/android-auto-proto';
import type {
    IMediaPlaybackMetadata,
    IMediaPlaybackStatus,
} from '@web-auto/android-auto-proto/interfaces.js';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';

export type AndroidAutoMediaStatusService = {
    getStatus(): Promise<IMediaPlaybackStatus | undefined>;
    getMetadata(): Promise<IMediaPlaybackMetadata | undefined>;
};

export type AndroidAutoMediaStatusClient = {
    status(status: IMediaPlaybackStatus | undefined): void;
    metadata(metadata: IMediaPlaybackMetadata | undefined): void;
};

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

    public override destroy(): void {
        this.ipcHandler.off('getMetadata');
        this.ipcHandler.off('getStatus');
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
}
