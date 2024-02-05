import './common.js';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { decoder } from './decoder.js';

import App from './App.vue';
import router from './router/index.js';

import { useMediaStatusStore } from './stores/media-status-store.js';
import { useVideoFocusModeStore } from './stores/video-store.js';
import { useDeviceStore } from './stores/device-store.js';
import {
    androidAutoInputService,
    androidAutoMediaStatusService,
    androidAutoServerService,
    androidAutoVideoService,
} from './ipc.js';
import { useInputStore } from './stores/input-store.js';

const app = createApp(App);

app.use(createPinia());
app.use(router);

const deviceStore = useDeviceStore();
const mediaStatusStore = useMediaStatusStore();
const videoFocusModeStore = useVideoFocusModeStore();
const inputStore = useInputStore();

const initialize = async () => {
    await deviceStore.initialize(androidAutoServerService);
    await mediaStatusStore.initialize(androidAutoMediaStatusService);
    await videoFocusModeStore.initialize(androidAutoVideoService);
    await inputStore.initialize(androidAutoInputService);

    decoder.start();

    app.mount('#app');
};

initialize()
    .then(() => {})
    .catch((err) => {
        console.error('Failed to initialize', err);
    });
