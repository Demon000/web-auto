<script setup lang="ts">
import type { IDevice } from '@web-auto/android-auto-ipc';
import Device from './Device.vue';
import { androidAutoServerService } from '../ipc.js';
import { computed, onMounted, ref, type Ref } from 'vue';

let devices: Ref<IDevice[]> = ref([]);

androidAutoServerService
    .getDevices()
    .then((updatedDevices) => {
        devices.value = updatedDevices;
    })
    .catch((err) => {
        console.error(err);
    });

const connectedDevice = computed(() => {
    for (const device of devices.value) {
        if (device.state === 'available' || device.state === 'disconnected') {
            continue;
        }

        return device;
    }

    return undefined;
});

onMounted(() => {
    androidAutoServerService.on('devices', (updatedDevices) => {
        devices.value = updatedDevices;
    });
});
</script>

<template>
    <div class="device-selector">
        <div class="title">Connections</div>

        <template v-if="connectedDevice !== undefined">
            <div class="section-title">Active</div>
            <device class="connected-device" :device="connectedDevice"></device>
        </template>

        <div class="section-title">Available</div>
        <div class="devices" v-for="device in devices">
            <device v-if="device !== connectedDevice" :device="device"></device>
        </div>
    </div>
</template>

<style scoped>
.device-selector {
    width: 100%;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 28px;

    padding: 32px;
}

.title {
    font-size: 32px;
    margin-bottom: 32px;
}

.section-title {
    opacity: 70%;
    font-size: 18px;
}

.device {
    margin: 16px 0;
}

.connected-device {
    margin-bottom: 32px;
}
</style>
