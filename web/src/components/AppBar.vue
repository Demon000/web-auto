<script setup lang="ts">
import AppBarIcon from './AppBarIcon.vue';
</script>

<template>
    <div class="app-bar">
        <router-link to="/" v-slot="{ isExactActive }">
            <AppBarIcon :selected="isExactActive">dashboard</AppBarIcon>
        </router-link>
        <router-link to="/connections" v-slot="{ isExactActive }">
            <AppBarIcon :selected="isExactActive">phonelink_ring</AppBarIcon>
        </router-link>
        <router-link to="/android-auto-video" v-slot="{ isExactActive }">
            <AppBarIcon :selected="isExactActive"
                ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
                    <path
                        stroke-linejoin="round"
                        stroke-width="14"
                        fill-opacity="0"
                        d="M56 146H26.074c-3.111 0-5.031-3.396-3.427-6.062l69.925-116.24c1.555-2.584 5.301-2.584 6.856 0l69.925 116.24c1.604 2.666-.316 6.062-3.427 6.062H136"
                    />
                    <path
                        stroke-linejoin="round"
                        stroke-width="14"
                        fill-opacity="0"
                        d="m42 170 54-92 54 92-54-24-54 24Z"
                    />
                </svg>
            </AppBarIcon>
        </router-link>
        <AppBarIcon>mode_fans</AppBarIcon>
        <AppBarIcon>radio</AppBarIcon>
        <AppBarIcon>lightbulb</AppBarIcon>
        <AppBarIcon>settings</AppBarIcon>
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
