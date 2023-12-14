/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SOCKET_IPC_CLIENT_HOST: string;
    readonly VITE_SOCKET_IPC_CLIENT_PORT: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
