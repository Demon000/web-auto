<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import {
    AndroidAutoServerClient,
    AndroidAutoServerService,
} from '@web-auto/node-common/ipc.js';
import AppBar from '../AppBar.vue';
import DeviceNotConnected from '../DeviceNotConnected.vue';
import { useDeviceStore } from '../../stores/device-store.js';
import { WEB_CONFIG } from '../../config.js';
import { ipcClientRegistry } from '../../ipc.js';

export interface HomeViewProps {
    serverIpcName: string;
    components: { name: string }[];
}

const props = defineProps<HomeViewProps>();

const androidAutoServerService = ipcClientRegistry.registerIpcClient<
    AndroidAutoServerClient,
    AndroidAutoServerService
>(props.serverIpcName);

const deviceStore = useDeviceStore(androidAutoServerService);

await deviceStore.initialize();
</script>

<template>
    <div class="home">
        <div class="main">
            <template v-if="deviceStore.connectedDevice !== undefined">
                <template
                    v-for="(config, _index) in components"
                    :key="`${config.name}-${_index}`"
                >
                    <component
                        :is="
                            defineAsyncComponent(
                                () =>
                                    import(`../home-tiles/${config.name}.vue`),
                            )
                        "
                        v-bind="config"
                    ></component>
                </template>
            </template>
            <template v-else>
                <DeviceNotConnected></DeviceNotConnected>
            </template>
        </div>
        <AppBar v-bind="WEB_CONFIG.appBar"></AppBar>
    </div>
</template>

<style scoped>
.home {
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
}

.main {
    padding: 32px;

    display: grid;
    flex-grow: 1;

    grid-auto-flow: column;

    gap: 32px;
    width: 100%;

    min-width: 0;
    min-height: 0;
}
</style>
