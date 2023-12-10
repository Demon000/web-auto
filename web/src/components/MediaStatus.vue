<script setup lang="ts">
import { computed } from 'vue';
import { useMediaStatusStore } from '../stores/media-status-store.ts';

const mediaStatuStore = useMediaStatusStore();

const albumArtUrl = computed(() => {
    const albumArt = mediaStatuStore.metadata?.albumArt;
    if (albumArt === undefined) {
        return undefined;
    }
    const blob = new Blob([albumArt], {
        type: 'image/png',
    });
    return `url(${URL.createObjectURL(blob)}`;
});
</script>

<template>
    <div class="media-status">
        <div class="media-status-details">
            <div class="source">{{ mediaStatuStore.status?.mediaSource }}</div>
            <div class="artist">{{ mediaStatuStore.metadata?.artist }}</div>
            <div class="song">{{ mediaStatuStore.metadata?.song }}</div>
            <div class="album">{{ mediaStatuStore.metadata?.album }}</div>
            <div class="duration">
                Playback
                {{ mediaStatuStore.status?.playbackSeconds }} /
                {{ mediaStatuStore.metadata?.durationSeconds }}
            </div>
            <div class="playlist">
                {{ mediaStatuStore.metadata?.playlist }}
            </div>
            <div class="shuffle">
                Shuffle: {{ mediaStatuStore.status?.shuffle }}
            </div>
            <div class="repeat">
                Repeat: {{ mediaStatuStore.status?.repeat }}
            </div>
            <div class="repeat-pne">
                Repeat one: {{ mediaStatuStore.status?.repeatOne }}
            </div>
            <div class="state">State: {{ mediaStatuStore.status?.state }}</div>
        </div>
    </div>
</template>

<style scoped>
.media-status {
    border: 2px solid var(--md-sys-color-outline);
    border-radius: 28px;
    overflow: hidden;

    background-image: v-bind(albumArtUrl);
    background-size: cover;
}

.media-status-details {
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.75);
    padding: 32px;
    font-size: 20px;
}
</style>
