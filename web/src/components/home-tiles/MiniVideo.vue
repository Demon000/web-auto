<script setup lang="ts">
import Video from '../Video.vue';

import '@material/web/fab/fab.js';
import '@material/web/icon/icon.js';
import {
    AndroidAutoServerClient,
    AndroidAutoServerService,
    AndroidAutoInputClient,
    AndroidAutoInputService,
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
} from '@web-auto/node-common/ipc.js';
import { ipcClientRegistry } from '../../ipc.js';
import { useDeviceStore } from '../../stores/device-store.js';
import router from '../../router/index.js';
import { useVideoFocusModeStore } from '../../stores/video-store.js';
import { ITouchEvent } from '@web-auto/android-auto-proto/interfaces.js';
import { getDecoder } from '../../decoders.js';
import { useVideoFocus } from './../video-focus.js';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';

export interface MiniVideoProps {
    fullVideoPath?: string;
    serverIpcName: string;
    videoServiceIpcName: string;
    inputServiceIpcName?: string;
    touchEventThrottlePixels?: number;
}

const props = defineProps<MiniVideoProps>();

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

const { onVideoVisible, onVideoHidden } = useVideoFocus(
    decoder,
    videoFocusStore,
    true,
);

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

const switchToVideoView = async () => {
    if (props.fullVideoPath === undefined) {
        return;
    }

    await router.push({
        path: props.fullVideoPath,
    });
};
</script>

<template>
    <div class="mini-video">
        <Video
            @touch-event="sendTouchEvent"
            @video-visible="onVideoVisible"
            @video-hidden="onVideoHidden"
            :touch="inputService !== undefined"
            :throttle-pixels="touchEventThrottlePixels"
        ></Video>
        <md-fab
            v-if="fullVideoPath !== undefined"
            class="open"
            variant="primary"
            @click="switchToVideoView"
        >
            <md-icon slot="icon">open_in_full</md-icon>
        </md-fab>
    </div>
</template>

<style scoped>
.mini-video {
    border: 2px solid var(--md-sys-color-outline);
    border-radius: 28px;
    overflow: hidden;
    position: relative;
}

.video {
    width: 100%;
    height: 100%;
}

.open {
    position: absolute;
    bottom: 64px;
    right: 64px;
}
</style>
