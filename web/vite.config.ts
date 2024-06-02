import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { loadConfig } from '@web-auto/config-loader';
import { NodeAndroidAutoConfig } from '@web-auto/node';
import UnpluginTypia from '@ryoppippi/unplugin-typia/vite';

const config = loadConfig<NodeAndroidAutoConfig>(
    (data) => data as NodeAndroidAutoConfig,
);

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        host: config.nodeAndroidAuto.webSocketServer.host,
        https: {
            cert: readFileSync('../cert.crt'),
            key: readFileSync('../cert.key'),
        },
    },
    build: {
        target: 'esnext',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'esnext',
        },
    },
    plugins: [
        UnpluginTypia({}),
        vue({
            template: {
                compilerOptions: {
                    isCustomElement(tag) {
                        return [
                            'md-icon',
                            'md-icon-button',
                            'md-filled-icon-button',
                            'md-fab',
                            'md-linear-progress',
                        ].includes(tag);
                    },
                },
            },
        }),
    ],
    define: {
        'import.meta.env.CONFIG': JSON.stringify(config),
    },
});
