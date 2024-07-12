<script setup lang="ts">
import '@material/web/slider/slider.js';
import AppBarIcon, { AppBarIconProps } from './AppBarIcon.vue';

import {
    AndroidAutoBrightnessClient,
    AndroidAutoBrightnessService,
} from '@web-auto/node-common/ipc.js';
import { ipcClientRegistry } from '../../ipc.js';
import { useBrightnessStore } from '../../stores/brightness-store.js';

export interface AppBarBrightnessProps extends AppBarIconProps {
    brightnessServiceIpcName: string;
}

const props = defineProps<AppBarBrightnessProps>();

const brightnessService = ipcClientRegistry.registerIpcClient<
    AndroidAutoBrightnessClient,
    AndroidAutoBrightnessService
>(props.brightnessServiceIpcName);

const brightnessStore = useBrightnessStore(brightnessService);

await brightnessStore.initialize();

const setBrightness = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const value = target.value as unknown as number;
    brightnessStore
        .setBrightness(value)
        .then(() => {})
        .catch((err) => {
            console.error('Failed to set brightness', err);
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
            :value="brightnessStore.brightness"
            @change="setBrightness"
        ></md-slider>
    </div>
</template>

<style scoped>
.slider-container {
    display: flex;
    align-items: center;
}
</style>
