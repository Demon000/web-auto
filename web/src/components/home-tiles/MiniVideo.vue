<script setup lang="ts">
import Video from '../Video.vue';

import '@material/web/fab/fab.js';
import '@material/web/icon/icon.js';
import {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
} from '@web-auto/node-common/ipc.js';
import { ipcClientRegistry } from '../../ipc.js';
import router from '../../router/index.js';
import { useVideoFocusModeStore } from '../../stores/video-store.js';

export interface MiniVideoProps {
    fullVideoPath?: string;
    videoServiceIpcName: string;
    inputServiceIpcName?: string;
    touchEventThrottlePixels?: number;
}

const props = defineProps<MiniVideoProps>();

const videoService = ipcClientRegistry.registerIpcClient<
    AndroidAutoVideoClient,
    AndroidAutoVideoService
>(props.videoServiceIpcName);

const videoFocusStore = useVideoFocusModeStore(videoService);

await videoFocusStore.initialize();

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
            @video-visible="videoFocusStore.onVideoVisible"
            @video-hidden="videoFocusStore.onVideoHidden"
            :input-service-ipc-name="inputServiceIpcName"
            :touch-event-throttle-pixels="touchEventThrottlePixels"
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
