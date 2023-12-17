import type { VideoFocusMode } from '@web-auto/android-auto-proto';
import type {
    IKeyEvent,
    IMediaPlaybackMetadata,
    IMediaPlaybackStatus,
    ITouchEvent,
    IVideoFocusNotification,
    IVideoFocusRequestNotification,
} from '@web-auto/android-auto-proto/interfaces.js';

export type AndroidAutoInputService = {
    sendTouchEvent: (touchEvent: ITouchEvent) => Promise<void>;
    sendKeyEvent: (keyEvent: IKeyEvent) => Promise<void>;
};

export type AndroidAutoInputClient = Record<string, never>;

export type VideoCodecConfig = {
    width: number;
    height: number;
    cropLeft: number;
    cropRight: number;
    cropTop: number;
    cropBottom: number;
    codec: string;
};

export type AndroidAutoVideoService = {
    sendVideoFocusNotification(data: IVideoFocusNotification): Promise<void>;
    isSetup(): Promise<boolean>;
    focusMode(): Promise<VideoFocusMode | undefined>;
};

export type AndroidAutoVideoClient = {
    focusRequest(data: IVideoFocusRequestNotification): void;
    afterSetup(): void;
    codecConfig(config: VideoCodecConfig): void;
    firstFrame(buffer: Buffer): void;
    stop(): void;
    data(buffer: Buffer): void;
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

export type AndroidAutoMediaStatusService = {
    getStatus(): Promise<IMediaPlaybackStatus | undefined>;
    getMetadata(): Promise<IMediaPlaybackMetadata | undefined>;
};

export type AndroidAutoMediaStatusClient = {
    status(status: IMediaPlaybackStatus | undefined): void;
    metadata(metadata: IMediaPlaybackMetadata | undefined): void;
};

export enum AndroidAutoIpcNames {
    SERVER = 'server',
    VIDEO = 'video',
    INPUT = 'input',
    MEDIA_STATUS = 'media-status',
}

export const ANDROID_AUTO_IPC_REGISTRY_NAME = 'android-auto';
