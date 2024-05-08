import {
    IMediaPlaybackStatus,
    IMediaPlaybackMetadata,
} from '@web-auto/android-auto-proto/interfaces.js';
import { defineStore } from 'pinia';
import { Ref, ref } from 'vue';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';
import {
    AndroidAutoMediaStatusClient,
    AndroidAutoMediaStatusService,
} from '@web-auto/node-common';

export const useMediaStatusStore = (
    service: IpcClientHandler<
        AndroidAutoMediaStatusClient,
        AndroidAutoMediaStatusService
    >,
) =>
    defineStore(service.handle, () => {
        let initialized = false;

        const status: Ref<IMediaPlaybackStatus | undefined> = ref(undefined);
        const metadata: Ref<IMediaPlaybackMetadata | undefined> =
            ref(undefined);

        async function initialize() {
            if (initialized) {
                return;
            }

            metadata.value = await service.getMetadata();
            status.value = await service.getStatus();

            service.on('metadata', (newMetadata) => {
                metadata.value = newMetadata;
            });

            service.on('status', (newStatus) => {
                status.value = newStatus;
            });

            initialized = true;
        }

        return { status, metadata, initialize };
    })();
