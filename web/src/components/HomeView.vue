<script setup lang="ts">
import AndroidAutoDeviceSelector from '../components/DeviceSelector.vue';
import AndroidAutoMiniVideo from '../components/MiniVideo.vue';
</script>

<template>
    <div class="home">
        <AndroidAutoDeviceSelector></AndroidAutoDeviceSelector>
        <AndroidAutoMiniVideo></AndroidAutoMiniVideo>
    </div>
</template>

<style scoped>
.home {
    width: 100%;
    height: 100%;
    flex-direction: row;
    display: flex;
    padding: 32px;
}

.device-selector {
    flex-grow: 1;
    margin-right: 32px;
}
</style>
