<script setup lang="ts">
import { IDevice } from '@web-auto/android-auto-ipc';
import Device from './Device.vue';

defineProps<{
    devices: IDevice[];
    connectedDevice?: IDevice;
}>();

const emit = defineEmits<{
    (e: 'connect', name: string): void;
    (e: 'disconnect', name: string): void;
}>();

const emitConnect = (name: string) => {
    emit('connect', name);
};

const emitDisconnect = (name: string) => {
    emit('disconnect', name);
};
</script>

<template>
    <div class="device-selector">
        <div class="title">Connections</div>

        <template v-if="connectedDevice !== undefined">
            <div class="section-title">Active</div>
            <device
                class="connected-device"
                :device="connectedDevice"
                @connect="emitConnect"
                @disconnect="emitDisconnect"
            ></device>
        </template>

        <div class="section-title">Available</div>
        <div class="devices" v-for="device in devices" :key="device.name">
            <device
                v-if="device !== connectedDevice"
                :device="device"
                @connect="emitConnect"
                @disconnect="emitDisconnect"
            ></device>
        </div>
    </div>
</template>

<style scoped>
.device-selector {
    border: 2px solid var(--md-sys-color-outline);
    border-radius: 28px;

    padding: 32px;

    overflow-y: auto;
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
