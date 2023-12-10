import {
    IMediaPlaybackStatus,
    IMediaPlaybackMetadata,
} from '@web-auto/android-auto-proto/interfaces.js';
import { defineStore } from 'pinia';
import { Ref, ref } from 'vue';
import { androidAutoMediaStatusService } from '../ipc.ts';

export const useMediaStatusStore = defineStore('media-status', () => {
    const status: Ref<IMediaPlaybackStatus | undefined> = ref(undefined);
    const metadata: Ref<IMediaPlaybackMetadata | undefined> = ref(undefined);

    async function initialize() {
        metadata.value = await androidAutoMediaStatusService.getMetadata();
        status.value = await androidAutoMediaStatusService.getStatus();

        androidAutoMediaStatusService.on('metadata', (newMetadata) => {
            metadata.value = newMetadata;
        });

        androidAutoMediaStatusService.on('status', (newStatus) => {
            status.value = newStatus;
        });
    }

    return { status, metadata, initialize };
});
