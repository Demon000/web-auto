<script setup lang="ts">
import AppBarIcon, { AppBarIconProps } from './AppBarIcon.vue';

export interface AppBarRouteIconProps extends AppBarIconProps {
    path: string;
}

const props = defineProps<AppBarRouteIconProps>();
</script>

<template>
    <router-link :to="path" v-slot="{ isExactActive }">
        <AppBarIcon v-bind="props" :selected="isExactActive"></AppBarIcon>
    </router-link>
</template>
