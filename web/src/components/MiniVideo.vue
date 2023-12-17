<script setup lang="ts">
import AndroidAutoVideo from '../components/Video.vue';

import '@material/web/fab/fab.js';
import '@material/web/icon/icon.js';
import router from '../router/index.ts';
import { VideoFocusMode } from '@web-auto/android-auto-proto';
import { IVideoFocusRequestNotification } from '@web-auto/android-auto-proto/interfaces.js';
import { onMounted, onBeforeUnmount } from 'vue';
import { androidAutoVideoService } from '../ipc.ts';

const onFocusRequest = async (data: IVideoFocusRequestNotification) => {
    if (data.mode === VideoFocusMode.VIDEO_FOCUS_NATIVE) {
        await androidAutoVideoService.sendVideoFocusNotification({
            focus: VideoFocusMode.VIDEO_FOCUS_NATIVE,
            unsolicited: true,
        });
        await androidAutoVideoService.sendVideoFocusNotification({
            focus: VideoFocusMode.VIDEO_FOCUS_PROJECTED,
            unsolicited: true,
        });
    }
};

const onOpenClick = async () => {
    await router.push({
        name: 'android-auto-video',
    });
};

onMounted(() => {
    androidAutoVideoService.on('focusRequest', onFocusRequest);
});

onBeforeUnmount(() => {
    androidAutoVideoService.off('focusRequest', onFocusRequest);
});
</script>

<template>
    <div class="mini-video">
        <AndroidAutoVideo></AndroidAutoVideo>
        <md-fab class="open" variant="primary" @click="onOpenClick">
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
