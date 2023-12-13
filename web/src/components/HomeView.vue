<script setup lang="ts">
import DeviceSelector from './DeviceSelector.vue';
import MiniVideo from './MiniVideo.vue';
import MediaStatus from './MediaStatus.vue';
import Assistant from './Assistant.vue';
import AppBar from './AppBar.vue';
import { Ref, computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { IDevice } from '@web-auto/android-auto-ipc';
import { androidAutoServerService } from '../ipc.ts';

const connectedDevice = computed(() => {
    for (const device of devices.value) {
        if (device.state === 'connected') {
            return device;
        }
    }

    return undefined;
});

const devices: Ref<IDevice[]> = ref([]);

const onDevices = (updatedDevices: IDevice[]) => {
    devices.value = updatedDevices;
};

onMounted(async () => {
    devices.value = await androidAutoServerService.getDevices();

    androidAutoServerService.on('devices', onDevices);
});

onBeforeUnmount(() => {
    androidAutoServerService.off('devices', onDevices);
});
</script>

<template>
    <div class="home">
        <AppBar></AppBar>
        <div
            class="main"
            :class="{
                unconnected: connectedDevice === undefined,
            }"
        >
            <DeviceSelector></DeviceSelector>
            <template v-if="connectedDevice !== undefined">
                <MiniVideo></MiniVideo>
                <MediaStatus></MediaStatus>
                <Assistant></Assistant>
            </template>
        </div>
    </div>
</template>

<style scoped>
.home {
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
}

.main {
    padding: 32px;

    display: grid;
    flex-grow: 1;

    grid-template-rows: 1fr 1fr;
    grid-template-columns: 1fr 1fr 1fr;

    gap: 32px;
    width: 100%;
    height: 100%;

    min-width: 0;
    min-height: 0;
}

.main .device-selector {
    grid-row-start: 1;
    grid-row-end: 3;

    grid-column-start: 1;
    grid-column-end: 2;
}

.main .mini-video {
    grid-row-start: 1;
    grid-row-end: 2;

    grid-column-start: 2;
    grid-column-end: 4;
}

.main .media-status {
    grid-row-start: 2;
    grid-column-start: 2;

    grid-row-end: 3;
    grid-column-end: 2;
}

.main .assistant {
    grid-row-start: 2;
    grid-column-start: 3;

    grid-row-end: 3;
    grid-column-end: 3;
}

.main.unconnected {
    grid-template-rows: 1fr;
    grid-template-columns: 1fr;
}

.main.unconnected .device-selector {
    grid-row-start: 1;
    grid-row-end: 1;

    grid-column-start: 1;
    grid-column-end: 1;
}
</style>
