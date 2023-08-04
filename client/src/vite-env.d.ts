/// <reference types="vite/client" />

interface Window {
    api: any;
}

declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent<{}, {}, any>;
    export default component;
}
