<script setup lang="ts">
import Video from '../Video.vue';
import router from '../../router/index.js';
import { watch } from 'vue';
import { useDeviceStore } from '../../stores/device-store.js';
import {
    AndroidAutoServerClient,
    AndroidAutoServerService,
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
} from '@web-auto/node-common/ipc.js';
import { ipcClientRegistry } from '../../ipc.js';
import { useVideoFocusModeStore } from '../../stores/video-store.js';
import { VideoFocusMode } from '@web-auto/android-auto-proto';

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

const videoService = ipcClientRegistry.registerIpcClient<
    AndroidAutoVideoClient,
    AndroidAutoVideoService
>(props.videoServiceIpcName);

const deviceStore = useDeviceStore(androidAutoServerService);
const videoFocusStore = useVideoFocusModeStore(videoService);

await deviceStore.initialize();
await videoFocusStore.initialize();

const switchToHomeView = async () => {
    if (props.exitVideoPath === undefined) {
        return;
    }

    await router.push({
        path: props.exitVideoPath,
    });
};

watch(
    () => videoFocusStore.requestedFocusMode,
    async (mode?: VideoFocusMode) => {
        if (mode === VideoFocusMode.VIDEO_FOCUS_NATIVE) {
            await switchToHomeView();
        }
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
            @video-visible="videoFocusStore.onVideoVisible"
            @video-hidden="videoFocusStore.onVideoHidden"
            :input-service-ipc-name="inputServiceIpcName"
            :touch-event-throttle-pixels="touchEventThrottlePixels"
        ></Video>
    </div>
</template>

<style scoped>
.video {
    width: 100%;
    height: 100%;
}
</style>
