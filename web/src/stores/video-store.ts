import { defineStore } from 'pinia';
import { Ref, nextTick, ref } from 'vue';
import { VideoFocusMode } from '@web-auto/android-auto-proto';
import {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
} from '@web-auto/android-auto-ipc';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';

export const useVideoFocusModeStore = defineStore('video-focus-mode', () => {
    const requestedFocusMode: Ref<VideoFocusMode | undefined> = ref(undefined);

    async function initialize(
        service: IpcClientHandler<
            AndroidAutoVideoClient,
            AndroidAutoVideoService
        >,
    ) {
        requestedFocusMode.value = undefined;

        service.on('focusRequest', async (data) => {
            requestedFocusMode.value = data.mode;
            await nextTick();
            requestedFocusMode.value = undefined;
        });
    }

    return { requestedFocusMode, initialize };
});
