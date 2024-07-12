import { AudioOutputService, type ServiceEvents } from '@web-auto/android-auto';
import { AudioStreamType } from '@web-auto/android-auto-proto';
import {
    stringToAudioStreamType,
    type IAudioConfiguration,
} from '@web-auto/android-auto-proto/interfaces.js';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';

export interface NodeAudioOutputServiceConfig {
    audioType: AudioStreamType | string;
    configs: IAudioConfiguration[];
}

export type AndroidAutoAudioOutputClient = Record<string, never>;

export type AndroidAutoAudioOutputService = {
    setVolume: (volume: number) => Promise<void>;
    getVolume: () => Promise<number>;
};

export class NodeAudioOutputService extends AudioOutputService {
    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoAudioOutputService,
            AndroidAutoAudioOutputClient
        >,
        config: NodeAudioOutputServiceConfig,
        events: ServiceEvents,
    ) {
        super(
            {
                ...config,
                audioType: stringToAudioStreamType(config.audioType),
            },
            events,
        );

        ipcHandler.on('getVolume', this.getVolume.bind(this));
        ipcHandler.on('setVolume', this.setVolume.bind(this));
    }

    public override destroy(): void {
        this.ipcHandler.off('getVolume');
        this.ipcHandler.off('setVolume');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async getVolume(): Promise<number> {
        return 1;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async setVolume(_volume: number): Promise<void> {
        throw new Error('Not implemented');
    }

    protected handleData(_buffer: Uint8Array, _timestamp?: bigint): void {}
}
