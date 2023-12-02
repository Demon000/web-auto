<script setup lang="ts">
import AndroidAutoVideo from '../components/AndroidAutoVideo.vue';
import AndroidAutoDeviceSelector from '../components/AndroidAutoDeviceSelector.vue';
</script>

<template>
    <main>
        <AndroidAutoDeviceSelector></AndroidAutoDeviceSelector>
        <AndroidAutoVideo></AndroidAutoVideo>
    </main>
</template>

<style scoped>
main {
    width: 100%;
    height: 100%;
    display: flex;
}

.android-auto-video {
    flex: 1;
}
</style>
