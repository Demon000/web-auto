/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SOCKET_IPC_CLIENT_HOST: string;
    readonly VITE_SOCKET_IPC_CLIENT_PORT: string;
    readonly VITE_VIDEO_DECODER_RENDERER: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
