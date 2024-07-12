import { defineStore } from 'pinia';
import { Ref, ref } from 'vue';
import {
    AndroidAutoAudioOutputClient,
    AndroidAutoAudioOutputService,
} from '@web-auto/node-common/ipc.js';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';

export interface VolumeStore {
    volume: number;
    setVolume: (value: number) => Promise<void>;
}

export const useVolumeStore = (
    service: IpcClientHandler<
        AndroidAutoAudioOutputClient,
        AndroidAutoAudioOutputService
    >,
) =>
    defineStore(service.handle, () => {
        const volume: Ref<number> = ref(0);
        let initialized = false;

        async function initialize() {
            if (initialized) {
                return;
            }

            volume.value = await service.getVolume();

            initialized = true;
        }

        const setVolume = async (value: number) => {
            await service.setVolume(value);
            volume.value = value;
        };

        return { volume, setVolume, initialize };
    })();
