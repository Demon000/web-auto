import {
    type TouchEvent,
    type VideoConfiguration,
} from '@web-auto/android-auto-proto';
import type { PartialMessage } from '@bufbuild/protobuf';

export type AndroidAutoInputService = {
    sendTouchEvent: (touchEvent: PartialMessage<TouchEvent>) => Promise<void>;
};

export type AndroidAutoInputClient = Record<string, never>;

export type AndroidAutoVideoService = {
    getVideoConfig(): Promise<PartialMessage<VideoConfiguration>>;
    getFirstBuffer(): Promise<Buffer | undefined>;
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
    getDevices(): Promise<IDevice[]>;
    getConnectedDevice(): Promise<IDevice | undefined>;
};

export type AndroidAutoServerClient = {
    devices: (devices: IDevice[]) => void;
    deviceConnected: (device: IDevice) => void;
    deviceDisconnected: () => void;
};

export enum AndroidAutoIpcNames {
    SERVER = 'server',
    VIDEO = 'video',
    INPUT = 'input',
}

export const ANDROID_AUTO_IPC_REGISTRY_NAME = 'android-auto';
