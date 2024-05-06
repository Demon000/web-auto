/// <reference types="vite/client" />
import { WebAndroidAutoConfig } from '../config.js';

interface ImportMetaEnv {
    readonly VITE_SOCKET_IPC_CLIENT_HOST: string;
    readonly VITE_SOCKET_IPC_CLIENT_PORT: string;
    readonly CONFIG: WebAndroidAutoConfig;
    readonly WEB_CONFIG: WebAndroidAutoConfig['web'];
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
