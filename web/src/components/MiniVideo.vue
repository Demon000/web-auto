<script setup lang="ts">
import Video from '../components/Video.vue';

import { ITouchEvent } from '@web-auto/android-auto-proto/interfaces.js';

import '@material/web/fab/fab.js';
import '@material/web/icon/icon.js';

const emit = defineEmits<{
    (e: 'video-visible', offscreenCanvas: OffscreenCanvas): void;
    (e: 'video-hidden'): void;
    (e: 'touch-event', touchEvent: ITouchEvent): void;
    (e: 'expand-video'): void;
}>();

const emitVideoVisible = (offscreenCanvas: OffscreenCanvas) => {
    emit('video-visible', offscreenCanvas);
};

const emitVideoHidden = () => {
    emit('video-hidden');
};

const emitTouchEvent = (touchEvent: ITouchEvent) => {
    emit('touch-event', touchEvent);
};
</script>

<template>
    <div class="mini-video">
        <Video
            @touch-event="emitTouchEvent"
            @video-visible="emitVideoVisible"
            @video-hidden="emitVideoHidden"
        ></Video>
        <md-fab class="open" variant="primary" @click="emit('expand-video')">
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
