<script setup lang="ts">
import AndroidAutoDeviceSelector from './DeviceSelector.vue';
import AndroidAutoMiniVideo from './MiniVideo.vue';
import AppBar from './AppBar.vue';
</script>

<template>
    <div class="home">
        <AppBar></AppBar>
        <div class="main">
            <AndroidAutoDeviceSelector></AndroidAutoDeviceSelector>
            <AndroidAutoMiniVideo></AndroidAutoMiniVideo>
        </div>
    </div>
</template>

<style scoped>
.home {
    width: 100%;
    height: 100%;

    flex-direction: column;
    display: flex;
}

.main {
    display: flex;
    flex-direction: row;
    flex-grow: 1;

    padding: 32px;
}

.device-selector {
    flex-grow: 1;
    margin-right: 32px;
}
</style>
