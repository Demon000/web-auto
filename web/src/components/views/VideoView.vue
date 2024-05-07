<script setup lang="ts">
import Video from '../Video.vue';
import { ITouchEvent } from '@web-auto/android-auto-proto/interfaces.js';
import router from '../../router/index.js';
import { useVideoFocus } from '../video-focus.js';
import { watch } from 'vue';
import { useDeviceStore } from '../../stores/device-store.js';
import {
    AndroidAutoServerClient,
    AndroidAutoServerService,
    AndroidAutoInputClient,
    AndroidAutoInputService,
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
} from '@web-auto/android-auto-ipc';
import { ipcClientRegistry } from '../../ipc.js';
import { getDecoder } from '../../decoders.js';
import { useVideoFocusModeStore } from '../../stores/video-store.js';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';

export interface VideoViewProps {
    exitVideoPath?: string;
    serverIpcName: string;
    inputServiceIpcName?: string;
    videoServiceIpcName: string;
    touchEventThrottlePixels: number;
}

const props = defineProps<VideoViewProps>();

const androidAutoServerService = ipcClientRegistry.registerIpcClient<
    AndroidAutoServerClient,
    AndroidAutoServerService
>(props.serverIpcName);

let inputService:
    | IpcClientHandler<AndroidAutoInputClient, AndroidAutoInputService>
    | undefined;

if (props.inputServiceIpcName !== undefined) {
    inputService = ipcClientRegistry.registerIpcClient<
        AndroidAutoInputClient,
        AndroidAutoInputService
    >(props.inputServiceIpcName);
}

const videoService = ipcClientRegistry.registerIpcClient<
    AndroidAutoVideoClient,
    AndroidAutoVideoService
>(props.videoServiceIpcName);

const deviceStore = useDeviceStore(androidAutoServerService);
const videoFocusStore = useVideoFocusModeStore(videoService);

await deviceStore.initialize();
await videoFocusStore.initialize();

const decoder = getDecoder(props.videoServiceIpcName);

const sendTouchEvent = (touchEvent: ITouchEvent) => {
    if (inputService === undefined) {
        return;
    }

    inputService
        .sendTouchEvent(touchEvent)
        .then(() => {})
        .catch((err) => {
            console.error('Failed to send touch event', err);
        });
};

const switchToHomeView = async () => {
    if (props.exitVideoPath === undefined) {
        return;
    }

    await router.push({
        path: props.exitVideoPath,
    });
};

const { onVideoVisible, onVideoHidden } = useVideoFocus(
    decoder,
    videoFocusStore,
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
            :touch="inputService !== undefined"
            :throttle-pixels="touchEventThrottlePixels"
        ></Video>
    </div>
</template>

<style scoped>
.video {
    width: 100%;
    height: 100%;
}
</style>
