import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        open: true,
    },
    build: {
        target: 'esnext',
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
