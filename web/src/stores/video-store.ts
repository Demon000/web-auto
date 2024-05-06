import { defineStore } from 'pinia';
import { Ref, nextTick, ref } from 'vue';
import { VideoFocusMode } from '@web-auto/android-auto-proto';
import {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
} from '@web-auto/android-auto-ipc';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';

export const useVideoFocusModeStore = (
    service: IpcClientHandler<AndroidAutoVideoClient, AndroidAutoVideoService>,
) =>
    defineStore(service.handle, () => {
        let initialized = false;

        const requestedFocusMode: Ref<VideoFocusMode | undefined> =
            ref(undefined);
        const usageCount: Ref<number> = ref(0);

        async function initialize() {
            if (initialized) {
                return;
            }

            requestedFocusMode.value = undefined;

            service.on('focusRequest', async (data) => {
                requestedFocusMode.value = data.mode;
                await nextTick();
                requestedFocusMode.value = undefined;
            });

            initialized = true;
        }

        const setFocusMode = async (focus: VideoFocusMode) => {
            if (service === undefined) {
                throw new Error('Cannot call before calling initialize');
            }

            try {
                await service.sendVideoFocusNotification({
                    focus,
                    unsolicited: true,
                });
            } catch (err) {
                console.error(err);
            }
        };

        const showProjected = async () => {
            await setFocusMode(VideoFocusMode.VIDEO_FOCUS_PROJECTED);
        };

        const showNative = async () => {
            await setFocusMode(VideoFocusMode.VIDEO_FOCUS_NATIVE);
        };

        const start = async () => {
            if (service === undefined) {
                throw new Error('Cannot call before calling initialize');
            }

            try {
                const channelStarted = await service.getChannelStarted();
                if (channelStarted) {
                    await showNative();
                }

                await showProjected();
            } catch (err) {
                console.error(err);
            }
        };

        const increaseUsageCount = async () => {
            usageCount.value++;

            if (usageCount.value === 1) {
                await start();
            }
        };

        const decreaseUsageCount = async () => {
            usageCount.value--;

            if (usageCount.value === 0) {
                await showNative();
            }
        };

        return {
            requestedFocusMode,
            setFocusMode,
            start,
            increaseUsageCount,
            decreaseUsageCount,
            initialize,
        };
    })();
