import '@fontsource/roboto';
import 'material-symbols';

import './assets/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router/index.js';

import {
    argbFromHex,
    themeFromSourceColor,
    applyTheme,
} from '@material/material-color-utilities';
import { useMediaStatusStore } from './stores/media-status-store.js';
import { useVideoFocusModeStore } from './stores/video-store.js';
import { useDeviceStore } from './stores/device-store.js';

const theme = themeFromSourceColor(argbFromHex('#60a8f0'));

applyTheme(theme, { target: document.body, dark: true });

const app = createApp(App);

app.use(createPinia());
app.use(router);

const deviceStore = useDeviceStore();
const mediaStatusStore = useMediaStatusStore();
const videoFocusModeStore = useVideoFocusModeStore();

const initialize = async () => {
    await deviceStore.initialize();
    await mediaStatusStore.initialize();
    await videoFocusModeStore.initialize();

    app.mount('#app');
    await router.replace({
        name: 'home',
    });
};

initialize();
