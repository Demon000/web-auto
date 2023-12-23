import './common.js';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { decoder } from './cluster-decoder.js';

import App from './App.vue';
import router from './router/cluster.js';

import { useVideoFocusModeStore } from './stores/video-store.js';
import { androidAutoClusterVideoService } from './ipc.js';

const app = createApp(App);

app.use(createPinia());
app.use(router);

const videoFocusModeStore = useVideoFocusModeStore();

const initialize = async () => {
    await videoFocusModeStore.initialize(androidAutoClusterVideoService);

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
