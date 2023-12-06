<script setup lang="ts">
import type { IDevice } from '@web-auto/android-auto-ipc';
import { androidAutoServerService } from '../ipc.js';
import { onMounted, ref, type Ref } from 'vue';

let devices: Ref<IDevice[]> = ref([]);

androidAutoServerService
    .getDevices()
    .then((updatedDevices) => {
        devices.value = updatedDevices;
    })
    .catch((err) => {
        console.error(err);
    });

const onConnectClick = async (name: string) => {
    try {
        await androidAutoServerService.connectDeviceName(name);
    } catch (err) {
        console.error(err);
    }
};

const onDisconnectClick = async (name: string) => {
    try {
        await androidAutoServerService.disconnectDeviceName(name);
    } catch (err) {
        console.error(err);
    }
};

onMounted(() => {
    androidAutoServerService.on('devices', (updatedDevices) => {
        devices.value = updatedDevices;
    });
});
</script>

<template>
    <div class="android-auto-device-selector">
        <div class="device" v-for="device in devices">
            <div class="name">{{ device.name }}</div>
            <div class="state">{{ device.state }}</div>
            <div
                v-if="device.state === 'available'"
                class="button connect-button"
                @click="onConnectClick(device.name)"
            >
                CONNECT
            </div>
            <div
                v-if="device.state === 'connected'"
                class="button disconnect-button"
                @click="onDisconnectClick(device.name)"
            >
                DISCONNECT
            </div>
        </div>
    </div>
</template>

<style scoped>
.android-auto-device-selector {
    padding: 16px;
}

.device {
    width: 100%;
    height: 64px;
    line-height: 64px;
    padding: 0 32px;
    font-size: 20px;
    background: #202124;
    border-radius: 32px;
    margin: 16px;

    display: flex;
    flex-direction: row;
    align-items: flex-start;
}

.name {
    margin-right: 16px;
}

.state {
    color: #5f6368;
}

.button {
    margin: 16px 0;
    height: 32px;
    line-height: 32px;
    border-radius: 16px;
    padding: 0 16px;
    font-size: 16px;
    cursor: pointer;
    background: #5f6368;
    user-select: none;
}

.connect-button,
.disconnect-button {
    margin-left: auto;
}
</style>
