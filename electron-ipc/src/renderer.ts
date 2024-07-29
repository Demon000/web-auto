import {
    ELECTRON_IPC_COMMUNICATION_CHANNEL,
    type IpcPreloadExposed,
} from './common.js';
import {
    BaseIpcSocket,
    DummyIpcSerializer,
    type IpcSocketEvents,
} from '@web-auto/common-ipc';
import { GenericIpcClientRegistry } from '@web-auto/common-ipc/renderer.js';
import type { IpcRendererEvent } from 'electron';

declare const window: {
    [ELECTRON_IPC_COMMUNICATION_CHANNEL]?: IpcPreloadExposed;
};

class ElectronClientIpcSocket extends BaseIpcSocket {
    private exposed: IpcPreloadExposed;
    private onDataInternalBound: (_event: IpcRendererEvent, data: any) => void;

    public constructor(
        private channelName: string,
        events: IpcSocketEvents,
    ) {
        super(events);

        this.onDataInternalBound = this.onDataInternal.bind(this);

        const exposed = window[ELECTRON_IPC_COMMUNICATION_CHANNEL];

        if (exposed === undefined) {
            throw new Error('IPC communication not exposed');
        }

        this.exposed = exposed;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async open(): Promise<void> {
        this.exposed.on(this.channelName, this.onDataInternalBound);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async close(): Promise<void> {
        this.exposed.off(this.channelName, this.onDataInternalBound);
    }

    private onDataInternal(_event: IpcRendererEvent, data: any): void {
        this.callOnData(data);
    }

    public send(data: any): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.exposed.send(this.channelName, data);
    }
}

export class ElectronIpcClientRegistry extends GenericIpcClientRegistry {
    public constructor(name: string) {
        const serializer = new DummyIpcSerializer();
        super(serializer, (events) => {
            return new ElectronClientIpcSocket(name, events);
        });
    }
}
