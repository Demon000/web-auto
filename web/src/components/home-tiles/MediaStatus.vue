<script setup lang="ts">
import { watch } from 'vue';

import {
    KeyCode,
    MediaPlaybackStatus_State,
} from '@web-auto/android-auto-proto';

import '@material/web/progress/linear-progress.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/fab/fab.js';
import { ipcClientRegistry } from '../../ipc.js';
import {
    AndroidAutoInputClient,
    AndroidAutoInputService,
    AndroidAutoMediaStatusClient,
    AndroidAutoMediaStatusService,
} from '@web-auto/node-common/ipc.js';
import { useMediaStatusStore } from '../../stores/media-status-store.js';

export interface MediaStatusProps {
    inputServiceIpcName: string;
    mediaStatusServiceIpcName: string;
}

const props = defineProps<MediaStatusProps>();

const mediaStatusService = ipcClientRegistry.registerIpcClient<
    AndroidAutoMediaStatusClient,
    AndroidAutoMediaStatusService
>(props.mediaStatusServiceIpcName);

const inputService = ipcClientRegistry.registerIpcClient<
    AndroidAutoInputClient,
    AndroidAutoInputService
>(props.inputServiceIpcName);

const mediaStatuStore = useMediaStatusStore(mediaStatusService);

await mediaStatuStore.initialize();

const sendKey = (keycode: KeyCode) => {
    inputService
        .sendKey(keycode)
        .then(() => {})
        .catch((err) => {
            console.error('Failed to send key event', err);
        });
};

let albumArtUrl: string | undefined;

watch(
    () => mediaStatuStore.metadata,
    (metadata) => {
        const albumArt = metadata?.albumArt;

        let newAlbumArtUrl: string | undefined;
        if (albumArt !== undefined) {
            const blob = new Blob([albumArt]);

            newAlbumArtUrl = URL.createObjectURL(blob);
        }

        if (albumArtUrl !== undefined) {
            URL.revokeObjectURL(albumArtUrl);
        }

        albumArtUrl = newAlbumArtUrl;
    },
    {
        immediate: true,
    },
);
</script>

<template>
    <div class="media-status">
        <img
            v-if="albumArtUrl !== undefined"
            class="image"
            :src="albumArtUrl"
        />
        <div class="details">
            <div class="song">{{ mediaStatuStore.metadata?.song }}</div>
            <div class="artist">{{ mediaStatuStore.metadata?.artist }}</div>

            <md-linear-progress
                class="progress"
                v-if="
                    mediaStatuStore.status?.playbackSeconds !== undefined &&
                    mediaStatuStore.metadata?.durationSeconds !== undefined
                "
                :value="
                    mediaStatuStore.status?.playbackSeconds /
                    mediaStatuStore.metadata?.durationSeconds
                "
                buffer="1"
            ></md-linear-progress>
            <div class="controls">
                <md-icon-button
                    @click="sendKey(KeyCode.KEYCODE_MEDIA_PREVIOUS)"
                >
                    <md-icon>skip_previous</md-icon>
                </md-icon-button>
                <md-fab
                    variant="primary"
                    @click="sendKey(KeyCode.KEYCODE_MEDIA_PLAY_PAUSE)"
                >
                    <md-icon
                        slot="icon"
                        v-if="
                            mediaStatuStore.status?.state ===
                                MediaPlaybackStatus_State.PAUSED ||
                            mediaStatuStore.status?.state ===
                                MediaPlaybackStatus_State.STOPPED
                        "
                        >play_arrow</md-icon
                    >
                    <md-icon slot="icon" v-else> pause </md-icon>
                </md-fab>
                <md-icon-button @click="sendKey(KeyCode.KEYCODE_MEDIA_NEXT)">
                    <md-icon>skip_next</md-icon>
                </md-icon-button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.media-status {
    border: 2px solid var(--md-sys-color-outline);
    border-radius: 28px;
    overflow: hidden;

    position: relative;
}

.image {
    width: 100%;
    height: 100%;
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    object-fit: cover;

    filter: blur(4px);
}

.details {
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.75);
    padding: 32px;
    font-size: 20px;
    position: relative;

    display: flex;
    flex-direction: column;
    justify-content: end;
}

.song {
    font-size: 32px;
    margin-bottom: 16px;
}

.progress {
    --md-linear-progress-track-height: 6px;
    --md-linear-progress-track-shape: 4px;
    --md-linear-progress-active-indicator-height: 6px;
    --md-linear-progress-active-indicator-color: #ffffff;
    --md-linear-progress-track-color: rgba(0, 0, 0, 0.25);

    margin: 32px 0;
    width: 100%;
}

.controls {
    margin-left: auto;
    margin-right: auto;
    display: flex;
    justify-content: space-around;
    align-items: center;
    font-size: 24px;
}

.controls > * {
    margin: 0 24px;
}
</style>
