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
    androidAutoMediaStatusService,
    androidAutoServerService,
    androidAutoVideoService,
} from './ipc.js';

const app = createApp(App);

app.use(createPinia());
app.use(router);

const deviceStore = useDeviceStore();
const mediaStatusStore = useMediaStatusStore();
const videoFocusModeStore = useVideoFocusModeStore();

const initialize = async () => {
    await deviceStore.initialize(androidAutoServerService);
    await mediaStatusStore.initialize(androidAutoMediaStatusService);
    await videoFocusModeStore.initialize(androidAutoVideoService);

    decoder.start();

    app.mount('#app');
    await router.replace({
        name: 'home',
    });
};

initialize()
    .then(() => {})
    .catch((err) => {
        console.error('Failed to initialize', err);
    });
