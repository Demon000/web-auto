import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import pkg from './package.json';

export default defineConfig(({ command }) => {
    rmSync('dist-electron', { recursive: true, force: true });

    const isServe = command === 'serve';
    const isBuild = command === 'build';
    const sourcemap = isServe;

    return {
        resolve: {
            alias: {
                '@web-auto/server': resolve(__dirname, '../server'),
            },
        },
        plugins: [
            vue(),
            electron([
                {
                    entry: 'electron/main/index.ts',
                    vite: {
                        build: {
                            sourcemap,
                            minify: isBuild,
                            outDir: 'dist-electron/main',
                            rollupOptions: {
                                external: Object.keys(
                                    'dependencies' in pkg
                                        ? pkg.dependencies
                                        : {},
                                ),
                            },
                        },
                    },
                },
                {
                    entry: 'electron/preload/index.ts',
                    onstart(options) {
                        options.reload();
                    },
                    vite: {
                        build: {
                            sourcemap: sourcemap ? 'inline' : undefined, // #332
                            minify: isBuild,
                            outDir: 'dist-electron/preload',
                            rollupOptions: {
                                external: Object.keys(
                                    'dependencies' in pkg
                                        ? pkg.dependencies
                                        : {},
                                ),
                            },
                        },
                    },
                },
            ]),
            // Use Node.js API in the Renderer-process
            renderer(),
        ],
        clearScreen: false,
    };
});
