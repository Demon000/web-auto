import './assets/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';

import { AndroidAutoCommuncationChannel } from './android-auto-ipc';
import { WebConfigCommuncationChannel } from './config-ipc';
import { WebConfigMainMethod } from '@web-auto/electron-ipc-web-config';

const androidAutoChannel = new AndroidAutoCommuncationChannel();
const webConfigChannel = new WebConfigCommuncationChannel();

webConfigChannel.invoke(WebConfigMainMethod.CONFIG).then((config) => {
    console.log(config);
});

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');
