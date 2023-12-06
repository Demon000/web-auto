<script setup lang="ts">
import NavigationBar from '../components/NavigationBar.vue';
</script>

<template>
    <main>
        <navigation-bar></navigation-bar>
        <router-view></router-view>
    </main>
</template>

<style scoped>
main {
    width: 100%;
    height: 100%;
    display: flex;
}

.android-auto-video {
    flex: 1;
}
</style>
