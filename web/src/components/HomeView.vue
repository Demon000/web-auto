<script setup lang="ts">
import DeviceSelector from './DeviceSelector.vue';
import MiniVideo from './MiniVideo.vue';
import MediaStatus from './MediaStatus.vue';
import Assistant from './Assistant.vue';
import AppBar from './AppBar.vue';
import { watch } from 'vue';
import { androidAutoInputService, androidAutoServerService } from '../ipc.ts';
import { KeyCode, VideoFocusMode } from '@web-auto/android-auto-proto';
import { useMediaStatusStore } from '../stores/media-status-store.ts';
import { useVideoFocusModeStore } from '../stores/video-store.ts';
import router from '../router/index.ts';
import { useDeviceStore } from '../stores/device-store.ts';
import { decoder } from '../decoder.ts';
import { ITouchEvent } from '@web-auto/android-auto-proto/interfaces.js';

const mediaStatusStore = useMediaStatusStore();
const videoFocusModeStore = useVideoFocusModeStore();
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
const sendAssistantKey = () => {
    sendKey(KeyCode.KEYCODE_SEARCH);
};

const switchToVideoView = async () => {
    await router.push({
        name: 'android-auto-video',
    });
};

watch(
    () => videoFocusModeStore.requestedFocusMode,
    async (mode?: VideoFocusMode) => {
        if (mode === VideoFocusMode.VIDEO_FOCUS_NATIVE) {
            await videoFocusModeStore.toggleFocusModeIfChannelStarted();
        } else if (mode === VideoFocusMode.VIDEO_FOCUS_PROJECTED) {
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

const connectDevice = async (name: string) => {
    try {
        await androidAutoServerService.connectDeviceName(name);
    } catch (err) {
        console.error(err);
    }
};

const disconnectDevice = async (name: string) => {
    try {
        await androidAutoServerService.disconnectDeviceName(name);
    } catch (err) {
        console.error(err);
    }
};
</script>

<template>
    <div class="home">
        <AppBar></AppBar>
        <div
            class="main"
            :class="{
                unconnected: deviceStore.connectedDevice === undefined,
            }"
        >
            <DeviceSelector
                :connected-device="deviceStore.notAvailableDevice"
                :devices="deviceStore.devices"
                @connect="connectDevice"
                @disconnect="disconnectDevice"
            ></DeviceSelector>
            <template v-if="deviceStore.connectedDevice !== undefined">
                <MiniVideo
                    @video-visible="onVideoVisible"
                    @video-hidden="onVideoHidden"
                    @expand-video="switchToVideoView"
                    @touch-event="sendTouchEvent"
                ></MiniVideo>
                <MediaStatus
                    @press-key="sendKey"
                    :metadata="mediaStatusStore.metadata"
                    :status="mediaStatusStore.status"
                ></MediaStatus>
                <Assistant @press-assistant-key="sendAssistantKey"></Assistant>
            </template>
        </div>
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

    grid-template-rows: 1fr 1fr;
    grid-template-columns: 1fr 1fr 1fr;

    gap: 32px;
    width: 100%;
    height: 100%;

    min-width: 0;
    min-height: 0;
}

.main .device-selector {
    grid-row-start: 1;
    grid-row-end: 3;

    grid-column-start: 1;
    grid-column-end: 2;
}

.main .mini-video {
    grid-row-start: 1;
    grid-row-end: 2;

    grid-column-start: 2;
    grid-column-end: 4;
}

.main .media-status {
    grid-row-start: 2;
    grid-column-start: 2;

    grid-row-end: 3;
    grid-column-end: 2;
}

.main .assistant {
    grid-row-start: 2;
    grid-column-start: 3;

    grid-row-end: 3;
    grid-column-end: 3;
}

.main.unconnected {
    grid-template-rows: 1fr;
    grid-template-columns: 1fr;
}

.main.unconnected .device-selector {
    grid-row-start: 1;
    grid-row-end: 1;

    grid-column-start: 1;
    grid-column-end: 1;
}
</style>
