import { nextTick, watch } from 'vue';
import { useVideoFocusModeStore } from '../stores/video-store.ts';
import { VideoFocusMode } from '@web-auto/android-auto-proto';
import { DecoderWorker } from '../codec/DecoderWorkerWrapper.ts';

export function useVideoFocus(
    decoder: DecoderWorker,
    restartOnNative?: true,
    onNative?: () => {},
) {
    const videoFocusModeStore = useVideoFocusModeStore();

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

    const onVideoVisible = async (offscreenCanvas: OffscreenCanvas) => {
        decoder.createRenderer(offscreenCanvas);
        await videoFocusModeStore.increaseUsageCount();
    };

    const onVideoHidden = async () => {
        await nextTick();
        await videoFocusModeStore.decreaseUsageCount();
    };

    return {
        onVideoVisible,
        onVideoHidden,
    };
}
