import { rmSync } from 'node:fs';
import { InlineConfig, defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import pkg from './package.json';
import { fileURLToPath } from 'node:url';

const commonResolveConfig: InlineConfig['resolve'] = {
    alias: {
        '@shared/': fileURLToPath(new URL('./shared/', import.meta.url)),
    },
};

const appResolveConfig: InlineConfig['resolve'] = {
    alias: {
        ...commonResolveConfig.alias,
        '@/': fileURLToPath(new URL('./src/', import.meta.url)),
    },
};

const electronResolveConfig: InlineConfig['resolve'] = {
    alias: {
        ...commonResolveConfig.alias,
        '@electron/': fileURLToPath(new URL('./electron/', import.meta.url)),
    },
};

export default defineConfig(({ command }) => {
    rmSync('dist-electron', { recursive: true, force: true });

    const isServe = command === 'serve';
    const isBuild = command === 'build';
    const sourcemap = isServe;

    return {
        resolve: appResolveConfig,
        plugins: [
            vue(),
            electron([
                {
                    entry: 'electron/main/index.ts',
                    vite: {
                        resolve: electronResolveConfig,
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
                        resolve: electronResolveConfig,
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
