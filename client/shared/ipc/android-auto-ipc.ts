export const ANDROID_AUTO_CHANNEL_NAME = 'android-auto';

export enum AndroidAutoRendererMethod {
    VIDEO_DATA = 'video-data',
}

export interface AndroidAutoRendererMethods {
    [AndroidAutoRendererMethod.VIDEO_DATA]: (buffer: Buffer) => void;
}

export enum AndroidAutoMainMethod {
    START = 'start',
    START_PROMISE = 'start-promise',
}

export interface AndroidAutoMainMethods {
    [AndroidAutoMainMethod.START]: () => void;
    [AndroidAutoMainMethod.START_PROMISE]: () => Promise<number>;
}
