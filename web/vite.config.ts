import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    // optimizeDeps: {
    //     include: [
    //         '../electron-ipc-renderer/*',
    //         '../electron-ipc-android-auto/*',
    //         '../electron-ipc-web-config/*',
    //     ],
    // },
    // build: {
    //     commonjsOptions: {
    //         include: [
    //             /..\/electron-ipc-renderer\/*/,
    //             /..\/electron-ipc-android-auto\/*/,
    //             /..\/electron-ipc-web-config\/*/,
    //             /node_modules/,
    //         ],
    //     },
    // },
});
