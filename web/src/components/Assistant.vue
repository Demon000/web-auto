<script setup lang="ts">
import '@material/web/fab/fab.js';

const emit = defineEmits<{
    (e: 'press-assistant-key'): void;
}>();
</script>

<template>
    <div class="assistant">
        <md-fab
            variant="primary"
            size="large"
            @click="emit('press-assistant-key')"
        >
            <md-icon slot="icon">mic</md-icon>
        </md-fab>
    </div>
</template>

<style scoped>
.assistant {
    border: 2px solid var(--md-sys-color-outline);
    border-radius: 28px;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
