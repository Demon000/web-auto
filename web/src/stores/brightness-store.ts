import { defineStore } from 'pinia';
import { Ref, ref } from 'vue';
import {
    AndroidAutoBrightnessClient,
    AndroidAutoBrightnessService,
} from '@web-auto/node-common/ipc.js';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';

export const useBrightnessStore = (
    service: IpcClientHandler<
        AndroidAutoBrightnessClient,
        AndroidAutoBrightnessService
    >,
) =>
    defineStore(service.handle, () => {
        const brightness: Ref<number> = ref(0);
        let initialized = false;

        async function initialize() {
            if (initialized) {
                return;
            }

            brightness.value = await service.getBrightness();

            initialized = true;
        }

        const setBrightness = async (value: number) => {
            await service.setBrightness(value);
            brightness.value = value;
        };

        return { brightness, setBrightness, initialize };
    })();
