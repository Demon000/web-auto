import { nextTick, watch } from 'vue';
import { useVideoFocusModeStore } from '../stores/video-store.js';
import { VideoFocusMode } from '@web-auto/android-auto-proto';
import { DecoderWorker } from '../codec/DecoderWorkerWrapper.js';

export const useVideoFocus = (
    decoder: DecoderWorker,
    videoFocusModeStore: ReturnType<typeof useVideoFocusModeStore>,
    restartOnNative?: true,
    onNative?: () => {},
) => {
    watch(
        () => videoFocusModeStore.requestedFocusMode,
        async (mode?: VideoFocusMode) => {
            if (
                (restartOnNative !== undefined &&
                    mode === VideoFocusMode.VIDEO_FOCUS_NATIVE) ||
                mode === VideoFocusMode.VIDEO_FOCUS_PROJECTED
            ) {
                await videoFocusModeStore.start();
            }

            if (
                onNative !== undefined &&
                mode === VideoFocusMode.VIDEO_FOCUS_NATIVE
            ) {
                onNative();
            }
        },
    );

    const onVideoVisible = async (
        offscreenCanvas: OffscreenCanvas,
        cookie: bigint,
    ) => {
        decoder.createRenderer(offscreenCanvas, cookie);
        await videoFocusModeStore.increaseUsageCount();
    };

    const onVideoHidden = async (cookie: bigint) => {
        decoder.destroyRenderer(cookie);
        await nextTick();
        await videoFocusModeStore.decreaseUsageCount();
    };

    return {
        onVideoVisible,
        onVideoHidden,
    };
};
