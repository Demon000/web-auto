import { defineStore } from 'pinia';
import { Ref, nextTick, ref, triggerRef } from 'vue';
import { androidAutoVideoService } from '../ipc.ts';
import { VideoFocusMode } from '@web-auto/android-auto-proto';

export const useVideoFocusModeStore = defineStore('video-focus-mode', () => {
    const requestedFocusMode: Ref<VideoFocusMode | undefined> = ref(undefined);

    async function initialize() {
        requestedFocusMode.value = undefined;

        androidAutoVideoService.on('focusRequest', async (data) => {
            requestedFocusMode.value = data.mode;
            await nextTick();
            requestedFocusMode.value = undefined;
        });
    }

    return { requestedFocusMode, initialize };
});
