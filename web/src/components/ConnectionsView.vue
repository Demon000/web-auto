<script setup lang="ts">
import DeviceSelector from './DeviceSelector.vue';
import AppBar from './AppBar.vue';
import { androidAutoServerService } from '../ipc.ts';
import { useDeviceStore } from '../stores/device-store.ts';

const deviceStore = useDeviceStore();

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
                :connected-device="deviceStore.notAvailableDevice"
                :devices="deviceStore.devices"
                @connect="connectDevice"
                @disconnect="disconnectDevice"
            ></DeviceSelector>
        </div>
        <AppBar></AppBar>
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
