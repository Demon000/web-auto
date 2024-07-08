<script setup lang="ts">
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';

export interface AppBarIconProps {
    selected?: boolean;
    content?: string;
}

defineProps<AppBarIconProps>();
</script>

<template>
    <div class="icon-container">
        <md-icon-button
            class="icon-button"
            :class="{
                selected,
            }"
        >
            <md-icon>
                <slot>
                    <span v-if="content !== undefined" v-html="content"></span>
                </slot>
            </md-icon>
        </md-icon-button>
    </div>
</template>

<style scoped>
.icon-container {
    --md-icon-button-icon-size: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.icon-button {
    width: 72px;
    height: 72px;
    border-radius: 36px;
}

.icon-button.selected {
    background: rgba(255, 255, 255, 0.15);
}

:slotted(:deep(svg)) {
    stroke: var(--_icon-color);
}
</style>
