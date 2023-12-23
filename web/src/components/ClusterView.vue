<script setup lang="ts">
import { VideoFocusMode } from '@web-auto/android-auto-proto';
import { watch } from 'vue';
import { decoder } from '../cluster-decoder.ts';
import Video from '../components/Video.vue';
import { useVideoFocusModeStore } from '../stores/video-store.ts';

const videoFocusModeStore = useVideoFocusModeStore();

watch(
    () => videoFocusModeStore.requestedFocusMode,
    async (mode?: VideoFocusMode) => {
        if (mode === VideoFocusMode.VIDEO_FOCUS_PROJECTED) {
            await videoFocusModeStore.showProjected();
        }
    },
);

const onVideoVisible = async (offscreenCanvas: OffscreenCanvas) => {
    decoder.createRenderer(offscreenCanvas);
    await videoFocusModeStore.toggleFocusModeIfChannelStarted();
};

const onVideoHidden = async () => {
    await videoFocusModeStore.showNative();
};
</script>

<template>
    <div class="video">
        <Video
            @video-visible="onVideoVisible"
            @video-hidden="onVideoHidden"
        ></Video>
    </div>
</template>

<style scoped>
.video {
    width: 100%;
    height: 100%;
}
</style>
