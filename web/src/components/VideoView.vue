<script setup lang="ts">
import Video from '../components/Video.vue';
import { androidAutoInputService } from '../ipc.ts';
import { ITouchEvent } from '@web-auto/android-auto-proto/interfaces.js';
import router from '../router/index.ts';
import { decoder } from '../decoder.ts';
import { useVideoFocus } from './video-focus.ts';
import { watch } from 'vue';
import { useDeviceStore } from '../stores/device-store.ts';

const deviceStore = useDeviceStore();

const sendTouchEvent = (touchEvent: ITouchEvent) => {
    androidAutoInputService
        .sendTouchEvent(touchEvent)
        .then(() => {})
        .catch((err) => {
            console.error('Failed to send touch event', err);
        });
};

const switchToHomeView = async () => {
    await router.push({
        name: 'home',
    });
};

const { onVideoVisible, onVideoHidden } = useVideoFocus(
    decoder,
    true,
    async () => {
        await switchToHomeView();
    },
);

watch(
    () => deviceStore.connectedDevice,
    async (connectedDevice) => {
        if (connectedDevice === undefined) {
            await switchToHomeView();
        }
    },
    {
        immediate: true,
    },
);
</script>

<template>
    <div class="video">
        <Video
            @touch-event="sendTouchEvent"
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
