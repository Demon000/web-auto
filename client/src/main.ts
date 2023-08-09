import App from './App.vue';
import { createApp } from 'vue';
import './style.css';
import { RendererCommuncationChannel } from './ipc/ipc';
import {
    ANDROID_AUTO_CHANNEL_NAME,
    AndroidAutoMainMethod,
    AndroidAutoRendererMethod,
    type AndroidAutoMainMethods,
    type AndroidAutoRendererMethods,
} from '@shared/ipc';
import type { DataBuffer } from '@web-auto/android-auto';

const androidAutoChannel = new RendererCommuncationChannel<
    AndroidAutoRendererMethods,
    AndroidAutoMainMethods
>(ANDROID_AUTO_CHANNEL_NAME);

const app = createApp(App);

app.mount('#app');

androidAutoChannel.send(AndroidAutoMainMethod.START);

androidAutoChannel.on(
    AndroidAutoRendererMethod.VIDEO_DATA,
    (buffer: DataBuffer) => {
        console.log(buffer);
    },
);
