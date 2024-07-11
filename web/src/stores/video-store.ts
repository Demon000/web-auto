import { defineStore } from 'pinia';
import { Ref, nextTick, ref } from 'vue';
import { VideoFocusMode } from '@web-auto/android-auto-proto';
import {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
} from '@web-auto/node-common/ipc.js';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';
import { getDecoder } from '../decoders.ts';

export const useVideoFocusModeStore = (
    service: IpcClientHandler<AndroidAutoVideoClient, AndroidAutoVideoService>,
) =>
    defineStore(service.handle, () => {
        const decoder = getDecoder(service.handle);

        let initialized = false;

        const requestedFocusMode: Ref<VideoFocusMode | undefined> =
            ref(undefined);
        const usageCount: Ref<number> = ref(0);

        async function initialize() {
            if (initialized) {
                return;
            }

            requestedFocusMode.value = undefined;

            service.on('channelStop', async () => {
                /*
                 * Channel stopped but we're still displaying, restart.
                 */
                if (usageCount.value !== 0) {
                    await start();
                }
            });

            service.on('focusRequest', async (data) => {
                if (
                    /*
                     * User pressed the exit button,
                     * but we might still be displaying, restart.
                     */
                    (data.mode === VideoFocusMode.VIDEO_FOCUS_NATIVE &&
                        usageCount.value !== 0) ||
                    /*
                     * Server notifies us that video can be used now, show it.
                     */
                    (data.mode === VideoFocusMode.VIDEO_FOCUS_PROJECTED &&
                        usageCount.value !== 0)
                ) {
                    await start();
                }

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

        const showProjected = () => {
            setFocusMode(VideoFocusMode.VIDEO_FOCUS_PROJECTED)
                .then(() => {})
                .catch((err) => {
                    console.error('Failed to set projected focus mode', err);
                });
        };

        const showNative = () => {
            setFocusMode(VideoFocusMode.VIDEO_FOCUS_NATIVE)
                .then(() => {})
                .catch((err) => {
                    console.error('Failed to set native focus mode', err);
                });
        };

        const start = async () => {
            if (service === undefined) {
                throw new Error('Cannot call before calling initialize');
            }

            try {
                const channelStarted = await service.getChannelStarted();
                if (channelStarted) {
                    showNative();
                }

                showProjected();
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
                showNative();
            }
        };

        const onVideoVisible = async (
            offscreenCanvas: OffscreenCanvas,
            cookie: bigint,
        ) => {
            decoder.createRenderer(offscreenCanvas, cookie);
            await increaseUsageCount();
        };

        const onVideoHidden = async (cookie: bigint) => {
            decoder.destroyRenderer(cookie);
            setTimeout(async () => {
                await decreaseUsageCount();
            }, 500);
        };

        return {
            requestedFocusMode,
            setFocusMode,
            start,
            onVideoVisible,
            onVideoHidden,
            initialize,
        };
    })();
