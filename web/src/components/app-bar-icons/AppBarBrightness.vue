<script setup lang="ts">
import '@material/web/slider/slider.js';
import AppBarIcon, { AppBarIconProps } from './AppBarIcon.vue';

import {
    AndroidAutoBrightnessClient,
    AndroidAutoBrightnessService,
} from '@web-auto/node-common/ipc.js';
import { ipcClientRegistry } from '../../ipc.js';
import { ref } from 'vue';

export interface AppBarBirghtnessProps extends AppBarIconProps {
    brightnessServiceIpcName: string;
}

const brightness = ref(0);

const props = defineProps<AppBarBirghtnessProps>();

const brightnessService = ipcClientRegistry.registerIpcClient<
    AndroidAutoBrightnessClient,
    AndroidAutoBrightnessService
>(props.brightnessServiceIpcName);

brightnessService
    .getBrightness()
    .then((value) => {
        brightness.value = value;
    })
    .catch((err) => {
        console.error('Failed to get brightness', err);
    });

const setBrightness = () => {
    brightnessService
        .setBrightness(brightness.value)
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
            v-model="brightness"
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
