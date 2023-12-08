<script setup lang="ts">
import '@fontsource/nunito-sans';
</script>

<template>
    <div class="app-bar">
        <div class="name"><span class="color">Web</span>Auto</div>
    </div>
</template>

<style scoped>
.app-bar {
    height: 96px;
    line-height: 96px;
    vertical-align: middle;
    padding: 0 32px;

    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    border-bottom-left-radius: 28px;
    border-bottom-right-radius: 28px;
}

.name {
    font-family: 'Nunito Sans';
    font-size: 40px;
    font-weight: bold;
}

.color {
    color: var(--md-sys-color-primary-container);
}
</style>
