import {
    type ITouchEvent,
    type IVideoConfig,
} from '@web-auto/android-auto-proto';

export type AndroidAutoInputService = {
    sendTouchEvent: (touchEvent: ITouchEvent) => Promise<void>;
};

export type AndroidAutoInputClient = Record<string, never>;

export type AndroidAutoVideoService = {
    getVideoConfig(): Promise<IVideoConfig>;
};

export type AndroidAutoVideoClient = {
    start: () => void;
    stop: () => void;
    data: (buffer: Buffer) => void;
};

export interface IDevice {
    prefix: string;
    name: string;
    realName: string;
    state: string;
}

export type AndroidAutoServerService = {
    connectDeviceName(name: string): Promise<void>;
    disconnectDeviceName(name: string): Promise<void>;
};

export type AndroidAutoServerClient = {
    devices: (devices: IDevice[]) => void;
};

export enum AndroidAutoIpcNames {
    SERVER = 'server',
    VIDEO = 'video',
    INPUT = 'input',
}

export const ANDROID_AUTO_IPC_REGISTRY_NAME = 'android-auto';
