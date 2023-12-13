<script setup lang="ts">
import { androidAutoInputService } from '../ipc.ts';
import { KeyCode } from '@web-auto/android-auto-proto';

import '@material/web/fab/fab.js';

const sendAssistantKey = () => {
    androidAutoInputService.sendKeyEvent({
        keys: [
            {
                down: true,
                keycode: KeyCode.KEYCODE_SEARCH,
                metastate: 0,
            },
            {
                down: false,
                keycode: KeyCode.KEYCODE_SEARCH,
                metastate: 0,
            },
        ],
    });
};
</script>

<template>
    <div class="assistant">
        <md-fab variant="primary" size="large" @click="sendAssistantKey">
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
