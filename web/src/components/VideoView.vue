<script setup lang="ts">
import Video from '../components/Video.vue';
import { androidAutoInputService } from '../ipc.ts';
import { ITouchEvent } from '@web-auto/android-auto-proto/interfaces.js';
import { VideoFocusMode } from '@web-auto/android-auto-proto';
import router from '../router/index.ts';
import { useVideoFocusModeStore } from '../stores/video-store.ts';
import { watch } from 'vue';
import { showNative, showProjected } from '../decoder.ts';

const videoFocusModeStore = useVideoFocusModeStore();

const sendTouchEvent = (touchEvent: ITouchEvent) => {
    androidAutoInputService.sendTouchEvent(touchEvent);
};

const switchToHomeView = async () => {
    await router.push({
        name: 'home',
    });
};

watch(
    () => videoFocusModeStore.requestedFocusMode,
    async (mode?: VideoFocusMode) => {
        if (mode === VideoFocusMode.VIDEO_FOCUS_NATIVE) {
            /*
             * Will unmount the video which will trigger a switch to native, which
             * will respond to focus request.
             */
            switchToHomeView();
        } else if (mode === VideoFocusMode.VIDEO_FOCUS_PROJECTED) {
            showProjected();
        }
    },
);
</script>

<template>
    <div class="video">
        <Video
            @touch-event="sendTouchEvent"
            @video-visible="showProjected"
            @video-hidden="showNative"
        ></Video>
    </div>
</template>

<style scoped>
.video {
    width: 100%;
    height: 100%;
}
</style>
