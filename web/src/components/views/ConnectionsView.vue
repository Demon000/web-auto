<script setup lang="ts">
import DeviceSelector from '../DeviceSelector.vue';
import AppBar from '../AppBar.vue';
import { useDeviceStore } from '../../stores/device-store.js';
import { ipcClientRegistry } from '../../ipc.js';
import {
    AndroidAutoServerClient,
    AndroidAutoServerService,
} from '@web-auto/node-common/ipc.js';
import { WEB_CONFIG } from '../../config.js';

export interface ConnectionsViewProps {
    serverIpcName: string;
}

const props = defineProps<ConnectionsViewProps>();

const androidAutoServerService = ipcClientRegistry.registerIpcClient<
    AndroidAutoServerClient,
    AndroidAutoServerService
>(props.serverIpcName);

const deviceStore = useDeviceStore(androidAutoServerService);

await deviceStore.initialize();

const connectDevice = async (name: string) => {
    try {
        await androidAutoServerService.connectDeviceName(name);
    } catch (err) {
        console.error(err);
    }
};

const disconnectDevice = async (name: string) => {
    try {
        await androidAutoServerService.disconnectDeviceName(name);
    } catch (err) {
        console.error(err);
    }
};
</script>

<template>
    <div class="connections">
        <div class="main">
            <DeviceSelector
                :connected-device="deviceStore.connectedDevice"
                :devices="deviceStore.supportedDevices"
                @connect="connectDevice"
                @disconnect="disconnectDevice"
            ></DeviceSelector>
        </div>
        <AppBar v-bind="WEB_CONFIG.appBar"></AppBar>
    </div>
</template>

<style scoped>
.connections {
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
}

.main {
    overflow: auto;
    width: 100%;
    height: 100%;

    display: flex;

    padding: 32px;
}

.device-selector {
    overflow: auto;
    width: 100%;
    height: 100%;
}
</style>
