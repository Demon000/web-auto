<script setup lang="ts">
import Video from '../components/Video.vue';
import { decoder } from '../cluster-decoder.ts';
import { useVideoFocus } from './video-focus.ts';

const { onVideoVisible, onVideoHidden } = useVideoFocus(decoder);
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
