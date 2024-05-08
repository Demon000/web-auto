<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

import { useDeviceStore } from '../stores/device-store.js';
import {
    AndroidAutoServerClient,
    AndroidAutoServerService,
} from '@web-auto/node-common';
import { ipcClientRegistry } from '../ipc.js';
import { AppBarRouteIconProps } from './app-bar-icons/AppBarRouteIcon.vue';
import { AppBarKeyIconProps } from './app-bar-icons/AppBarKeyIcon.vue';
import { AppBarIconProps } from './app-bar-icons/AppBarIcon.vue';

export type AppBarComponent = {
    onlyShowIfDeviceConnected?: boolean;
    path?: string;
} & (
    | ({ name: 'AppBarIcon' } & AppBarIconProps)
    | ({ name: 'AppBarRouteIcon' } & AppBarRouteIconProps)
    | ({ name: 'AppBarKeyIcon' } & AppBarKeyIconProps)
);

export interface AppBarProps {
    serverIpcName: string;
    components: AppBarComponent[];
}

const props = defineProps<AppBarProps>();

const androidAutoServerService = ipcClientRegistry.registerIpcClient<
    AndroidAutoServerClient,
    AndroidAutoServerService
>(props.serverIpcName);

const deviceStore = useDeviceStore(androidAutoServerService);

await deviceStore.initialize();
</script>

<template>
    <div class="app-bar">
        <template
            v-for="(config, _index) in components"
            :key="`${config.name}-${_index}`"
        >
            <component
                v-if="
                    config.onlyShowIfDeviceConnected === undefined ||
                    (config.onlyShowIfDeviceConnected === true &&
                        deviceStore.connectedDevice !== undefined)
                "
                :is="
                    defineAsyncComponent(
                        () => import(`./app-bar-icons/${config.name}.vue`),
                    )
                "
                v-bind="config"
            >
            </component>
        </template>
    </div>
</template>

<style scoped>
.app-bar {
    padding: 0 16px;

    display: flex;

    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    border-top-left-radius: 28px;
    border-top-right-radius: 28px;
}
</style>
