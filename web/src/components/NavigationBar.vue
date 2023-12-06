<script setup lang="ts">
import router from '../router/index.ts';

const onConnectClick = () => {
    router.push('device-selector');
};

const onCarClick = () => {
    router.push('android-auto-video');
};
</script>

<template>
    <div class="navigation-bar">
        <div class="item" @click="onConnectClick">
            <span class="icon material-symbols-outlined">smartphone</span>
            <span class="name">CONNECT</span>
        </div>
        <div class="item" @click="onCarClick">
            <span class="icon material-symbols-outlined">directions_car</span>
            <span class="name">CAR</span>
        </div>
    </div>
</template>

<style scoped>
.navigation-bar {
    background: #17181b;
    width: 128px;
}

.item {
    width: 100%;
    cursor: pointer;
    text-align: center;
    margin: 32px 0;
}

.item .icon {
    width: 100%;
    font-size: 48px;
    line-height: 64px;
}

.item .name {
    display: block;
    font-size: 14px;
    line-height: 16px;
}
</style>
