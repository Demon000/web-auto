<script setup lang="ts">
import AndroidAutoVideo from '../components/Video.vue';

import '@material/web/fab/fab.js';
import '@material/web/icon/icon.js';
import router from '../router/index.ts';

const onOpenClick = async () => {
    await router.push({
        name: 'android-auto-video',
    });
};
</script>

<template>
    <div class="mini-video">
        <android-auto-video></android-auto-video>
        <md-fab
            class="open"
            size="large"
            variant="primary"
            @click="onOpenClick"
        >
            <md-icon slot="icon">open_in_full</md-icon>
        </md-fab>
    </div>
</template>

<style scoped>
.mini-video {
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 28px;
    overflow: hidden;
}

.open {
    position: absolute;
    bottom: 64px;
    right: 64px;
}
</style>
