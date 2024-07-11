<script setup lang="ts">
import type { IDevice } from '@web-auto/node-common/ipc.js';

import '@material/web/iconbutton/filled-icon-button.js';
import '@material/web/icon/icon.js';

export interface DeviceProps {
    device: IDevice;
}

defineProps<DeviceProps>();

const emit = defineEmits<{
    (e: 'connect', name: string): void;
    (e: 'disconnect', name: string): void;
}>();
</script>

<template>
    <div class="device">
        <div class="name-state-container">
            <div class="name-container">
                <span class="name">{{ device.realName }}</span>
                <span class="unique-id">{{ device.uniqueId }}</span>
                <span class="prefix">{{ device.prefix }}</span>
            </div>
            <div class="state">{{ device.state }}</div>
        </div>

        <div class="button-container">
            <md-filled-icon-button
                class="connect-button"
                @click="emit('connect', device.name)"
                v-if="device.state === 'available'"
            >
                <md-icon>link</md-icon>
            </md-filled-icon-button>

            <md-filled-icon-button
                class="disconnect-button"
                @click="emit('disconnect', device.name)"
                v-else-if="device.state === 'connected'"
            >
                <md-icon>close</md-icon>
            </md-filled-icon-button>
        </div>
    </div>
</template>
<style scoped>
.device {
    width: 100%;
    border-radius: 28px;
    padding: 24px;

    font-size: 20px;
    line-height: 32px;

    display: flex;
    flex-direction: row;
    align-items: stretch;

    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
}

.state {
    color: var(--md-sys-color-on-surface);
    opacity: 50%;
}

.name-container > * {
    display: inline-block;
    word-break: break-all;
}

.name {
    margin-right: 8px;
}

.unique-id {
    margin-right: 8px;
    opacity: 50%;
}

.prefix {
    opacity: 50%;
}

.button-container {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
</style>
