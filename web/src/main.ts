import './theme.js';
import './decoders.js';

import { ipcClientRegistry } from './ipc.js';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router/index.js';
import { initializeDecoders } from './decoders.js';

const app = createApp(App);

app.use(createPinia());
app.use(router);

const initialize = async () => {
    await ipcClientRegistry.register();

    initializeDecoders();

    app.mount('#app');
};

initialize()
    .then(() => {})
    .catch((err) => {
        console.error('Failed to initialize', err);
    });
