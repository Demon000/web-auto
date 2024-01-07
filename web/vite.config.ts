import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        host: '192.168.0.106',
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
});
