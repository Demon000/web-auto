import type {
    IInsets,
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
    croppedWidth: number;
    croppedHeight: number;
    width: number;
    height: number;
    margins: IInsets;
    codec: string;
};

export type AndroidAutoVideoService = {
    sendVideoFocusNotification(data: IVideoFocusNotification): Promise<void>;
    getChannelStarted(): Promise<boolean>;
};

export type AndroidAutoVideoClient = {
    focusRequest(data: IVideoFocusRequestNotification): void;
    codecConfig(config: VideoCodecConfig): void;
    firstFrame(buffer: Uint8Array): void;
    channelStart(): void;
    channelStop(): void;
    data(buffer: Uint8Array): void;
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
    CLUSTER_VIDEO = 'cluster-video',
    INPUT = 'input',
    MEDIA_STATUS = 'media-status',
}

export const ANDROID_AUTO_IPC_REGISTRY_NAME = 'android-auto';
