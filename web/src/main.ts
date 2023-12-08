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

const theme = themeFromSourceColor(argbFromHex('#60a8f0'));

applyTheme(theme, { target: document.body, dark: true });

const app = createApp(App);

app.use(createPinia());
app.use(router);

router
    .replace({
        name: 'home',
    })
    .catch((err) => {
        console.error(err);
    });

app.mount('#app');
