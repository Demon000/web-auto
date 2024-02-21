<script setup lang="ts">
import MiniVideo from './MiniVideo.vue';
import MediaStatus from './MediaStatus.vue';
import AppBar from './AppBar.vue';
import { androidAutoInputService } from '../ipc.ts';
import { KeyCode } from '@web-auto/android-auto-proto';
import { useMediaStatusStore } from '../stores/media-status-store.ts';
import router from '../router/index.ts';
import { useDeviceStore } from '../stores/device-store.ts';
import { decoder } from '../decoder.ts';
import { ITouchEvent } from '@web-auto/android-auto-proto/interfaces.js';
import DeviceNotConnected from './DeviceNotConnected.vue';
import { useVideoFocus } from './video-focus.ts';

const mediaStatusStore = useMediaStatusStore();
const deviceStore = useDeviceStore();

const sendKey = (keycode: KeyCode) => {
    androidAutoInputService
        .sendKeyEvent({
            keys: [
                {
                    down: true,
                    keycode,
                    metastate: 0,
                },
                {
                    down: false,
                    keycode,
                    metastate: 0,
                },
            ],
        })
        .then(() => {})
        .catch((err) => {
            console.error('Failed to send key event', err);
        });
};

const sendTouchEvent = (touchEvent: ITouchEvent) => {
    androidAutoInputService
        .sendTouchEvent(touchEvent)
        .then(() => {})
        .catch((err) => {
            console.error('Failed to send touch event', err);
        });
};

const switchToVideoView = async () => {
    await router.push({
        name: 'android-auto-video',
    });
};

const { onVideoVisible, onVideoHidden } = useVideoFocus(decoder, true);
</script>

<template>
    <div class="home">
        <div class="main">
            <template v-if="deviceStore.connectedDevice !== undefined">
                <MiniVideo
                    @video-visible="onVideoVisible"
                    @video-hidden="onVideoHidden"
                    @expand-video="switchToVideoView"
                    @touch-event="sendTouchEvent"
                ></MiniVideo>
                <MediaStatus
                    v-if="
                        mediaStatusStore.metadata !== undefined &&
                        mediaStatusStore.status !== undefined
                    "
                    @press-key="sendKey"
                    :metadata="mediaStatusStore.metadata"
                    :status="mediaStatusStore.status"
                ></MediaStatus>
            </template>
            <template v-else>
                <DeviceNotConnected></DeviceNotConnected>
            </template>
        </div>
        <AppBar></AppBar>
    </div>
</template>

<style scoped>
.home {
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
}

.main {
    padding: 32px;

    display: grid;
    flex-grow: 1;

    grid-auto-flow: column;

    gap: 32px;
    width: 100%;

    min-width: 0;
    min-height: 0;
}
</style>
