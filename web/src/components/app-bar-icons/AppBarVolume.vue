<script setup lang="ts">
import '@material/web/slider/slider.js';
import AppBarIcon, { AppBarIconProps } from './AppBarIcon.vue';

import {
    AndroidAutoAudioOutputClient,
    AndroidAutoAudioOutputService,
} from '@web-auto/node-common/ipc.js';
import { ipcClientRegistry } from '../../ipc.js';
import { VolumeStore, useVolumeStore } from '../../stores/volume-store.js';

export interface AppBarVolumeProps extends AppBarIconProps {
    audioOutputServicesIpcName: string[];
}

const props = defineProps<AppBarVolumeProps>();
const stores: VolumeStore[] = [];

for (const ipcName of props.audioOutputServicesIpcName) {
    const service = ipcClientRegistry.registerIpcClient<
        AndroidAutoAudioOutputClient,
        AndroidAutoAudioOutputService
    >(ipcName);
    const store = useVolumeStore(service);
    await store.initialize();
    stores.push(store);
}

const setVolume = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const value = target.value as unknown as number;
    const promises = [];
    for (const store of stores) {
        const promise = store.setVolume(value);
        promises.push(promise);
    }
    Promise.all(promises)
        .then(() => {})
        .catch((err) => {
            console.error('Failed to set volume', err);
        });
};
</script>

<template>
    <div class="slider-container">
        <AppBarIcon v-bind="props"></AppBarIcon>
        <md-slider
            min="0"
            max="1"
            step="0.1"
            :value="stores[0].volume"
            @change="setVolume"
        ></md-slider>
    </div>
</template>

<style scoped>
.slider-container {
    display: flex;
    align-items: center;
}
</style>
