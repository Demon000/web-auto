<script setup lang="ts">
import AndroidAutoDeviceSelector from './DeviceSelector.vue';
import AndroidAutoMiniVideo from './MiniVideo.vue';
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
        <div class="main">
            <AndroidAutoDeviceSelector></AndroidAutoDeviceSelector>
            <AndroidAutoMiniVideo
                v-if="connectedDevice !== undefined"
            ></AndroidAutoMiniVideo>
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
