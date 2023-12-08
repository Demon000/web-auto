<script setup lang="ts">
import type { IDevice } from '@web-auto/android-auto-ipc';
import { androidAutoServerService } from '../ipc.ts';

import '@material/web/iconbutton/filled-icon-button.js';
import '@material/web/icon/icon.js';

defineProps<{
    device: IDevice;
}>();

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
</script>

<template>
    <div class="device">
        <div class="name-state-container">
            <div class="name">{{ device.realName }}</div>
            <div class="state">{{ device.state }}</div>
        </div>

        <div class="button-container">
            <md-filled-icon-button
                class="connect-button"
                @click="onConnectClick(device.name)"
                v-if="device.state === 'available'"
            >
                <md-icon>link</md-icon>
            </md-filled-icon-button>

            <md-filled-icon-button
                class="disconnect-button"
                @click="onDisconnectClick(device.name)"
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
    color: #5f6368;
}

.button-container {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
</style>
