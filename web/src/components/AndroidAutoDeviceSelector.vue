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

const deviceHandlers = computed(() => {
    const deviceHandlers: Record<string, IDevice[]> = {};
    for (const device of devices.value) {
        if (!(device.prefix in deviceHandlers)) {
            deviceHandlers[device.prefix] = [];
        }

        deviceHandlers[device.prefix].push(device);
    }

    return deviceHandlers;
});

const connectedDevice = computed(() => {
    for (const device of devices.value) {
        if (device.state === 'available' || device.state === 'disconnected') {
            continue;
        }

        return device;
    }
});

onMounted(() => {
    androidAutoServerService.on('devices', (updatedDevices) => {
        devices.value = updatedDevices;
    });
});
</script>

<template>
    <div class="android-auto-device-selector">
        <div class="device-handler" v-if="connectedDevice !== undefined">
            <div class="title">Connected</div>

            <div class="devices">
                <device :device="connectedDevice"></device>
            </div>
        </div>

        <div
            class="device-handler"
            v-for="(devices, deviceHandler) in deviceHandlers"
            :key="deviceHandler"
        >
            <div class="title">
                <template v-if="deviceHandler === 'TCP'"> Network </template>
                <template v-else-if="deviceHandler === 'BT'">
                    Bluetooth
                </template>
                <template v-else>
                    {{ deviceHandler }}
                </template>
            </div>

            <div class="devices" v-for="device in devices">
                <device :device="device"></device>
            </div>
        </div>
    </div>
</template>

<style scoped>
.android-auto-device-selector {
    padding: 16px;
    width: 100%;
}

.device-handler {
    font-size: 32px;
    margin: 32px 16px;
    padding: 0 32px;
}
</style>
