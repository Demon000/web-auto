<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';
import AndroidAutoVideo from '../components/Video.vue';
import { androidAutoVideoService } from '../ipc.ts';
import { IVideoFocusRequestNotification } from '@web-auto/android-auto-proto/interfaces.js';
import { VideoFocusMode } from '@web-auto/android-auto-proto';
import router from '../router/index.ts';

const onFocusRequest = async (data: IVideoFocusRequestNotification) => {
    if (data.mode === VideoFocusMode.VIDEO_FOCUS_NATIVE) {
        await androidAutoVideoService.sendVideoFocusNotification({
            focus: VideoFocusMode.VIDEO_FOCUS_NATIVE,
            unsolicited: true,
        });

        await router.push({
            name: 'home',
        });
    }
};

onMounted(() => {
    androidAutoVideoService.on('focusRequest', onFocusRequest);
});

onBeforeUnmount(() => {
    androidAutoVideoService.off('focusRequest', onFocusRequest);
});
</script>

<template>
    <div class="video">
        <AndroidAutoVideo></AndroidAutoVideo>
    </div>
</template>

<style scoped>
.video {
    width: 100%;
    height: 100%;
}
</style>
