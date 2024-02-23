import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { lilconfigSync } from 'lilconfig';
import { NodeAndroidAutoConfig } from '@web-auto/node';
import JSON5 from 'json5';

export type WebAndroidAutoConfig = {
    web: {
        videoDecoderRenderer: string;
    };
} & NodeAndroidAutoConfig;

const config = lilconfigSync('web-auto', {
    loaders: {
        '.json5': (_filepath, content) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return JSON5.parse(content);
        },
    },
    searchPlaces: ['config.json5'],
}).search()?.config as WebAndroidAutoConfig;

const { port: nodePort, host: nodeHost } =
    config.nodeAndroidAuto.webSocketServer;

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        host: nodeHost,
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
                nested: resolve(__dirname, 'cluster/index.html'),
            },
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'esnext',
        },
    },
    plugins: [
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
        'import.meta.env.VITE_SOCKET_IPC_CLIENT_HOST': `"wss://${nodeHost}"`,
        'import.meta.env.VITE_SOCKET_IPC_CLIENT_PORT': `${nodePort}`,
        'import.meta.env.VITE_VIDEO_DECODER_RENDERER': `"${config.web.videoDecoderRenderer}"`,
    },
});
