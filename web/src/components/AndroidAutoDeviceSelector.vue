<script setup lang="ts">
import { androidAutoChannel } from '@/ipc/channels';
import { AndroidAutoMainMethod } from '@web-auto/electron-ipc-android-auto';
import {
    AndroidAutoRendererMethod,
    type IDevice,
} from '@web-auto/electron-ipc-android-auto';
import { onMounted, ref, type Ref } from 'vue';

let devices: Ref<IDevice[]> = ref([]);

const onConnectClick = async (name: string) => {
    try {
        console.log('connect', name);
        await androidAutoChannel.invoke(
            AndroidAutoMainMethod.CONNECT_DEVICE,
            name,
        );
    } catch (err) {
        console.log(err);
    }
};

const onDisconnectClick = async (name: string) => {
    try {
        await androidAutoChannel.invoke(
            AndroidAutoMainMethod.DISCONNECT_DEVICE,
            name,
        );
    } catch (err) {
        console.log(err);
    }
};

onMounted(() => {
    androidAutoChannel.on(
        AndroidAutoRendererMethod.DEVICES_UPDATED,
        (updatedDevices) => {
            console.log(updatedDevices);
            devices.value = updatedDevices;
        },
    );
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
    position: absolute;
    top: 0;
    left: 0;
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
    color: #fff;
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
