import '@fontsource/roboto';
import 'material-symbols';

import './assets/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router/index.js';

const app = createApp(App);

app.use(createPinia());
app.use(router);

router
    .replace({
        name: 'device-selector',
    })
    .catch((err) => {
        console.error(err);
    });

app.mount('#app');
