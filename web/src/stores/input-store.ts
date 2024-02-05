import { defineStore } from 'pinia';
import { Ref, ref } from 'vue';
import {
    AndroidAutoInputClient,
    AndroidAutoInputService,
} from '@web-auto/android-auto-ipc';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';

export const useInputStore = defineStore('input', () => {
    const throttlePixels: Ref<number> = ref(1);

    async function initialize(
        service: IpcClientHandler<
            AndroidAutoInputClient,
            AndroidAutoInputService
        >,
    ) {
        throttlePixels.value = await service.touchEventThrottlePixels();
    }

    return { throttlePixels, initialize };
});
