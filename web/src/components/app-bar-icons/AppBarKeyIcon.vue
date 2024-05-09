<script setup lang="ts">
import AppBarIcon, { AppBarIconProps } from './AppBarIcon.vue';

import {
    AndroidAutoInputClient,
    AndroidAutoInputService,
} from '@web-auto/node-common/ipc.js';
import { ipcClientRegistry } from '../../ipc.js';
import { KeyCode } from '@web-auto/android-auto-proto';

export interface AppBarKeyIconProps extends AppBarIconProps {
    inputServiceIpcName: string;
    keycode: KeyCode | string;
}

const props = defineProps<AppBarKeyIconProps>();

const inputService = ipcClientRegistry.registerIpcClient<
    AndroidAutoInputClient,
    AndroidAutoInputService
>(props.inputServiceIpcName);

const sendKey = () => {
    inputService
        .sendKey(props.keycode)
        .then(() => {})
        .catch((err) => {
            console.error('Failed to send key event', err);
        });
};
</script>

<template>
    <AppBarIcon @click="sendKey" v-bind="props"></AppBarIcon>
</template>
