import { ITouchEvent } from '@web-auto/android-auto-proto';

export const ANDROID_AUTO_CHANNEL_NAME = 'android-auto';

export enum AndroidAutoRendererMethod {
    VIDEO_DATA = 'video-data',
}

export interface AndroidAutoRendererMethods {
    [AndroidAutoRendererMethod.VIDEO_DATA]: (buffer: Buffer) => void;
}

export enum AndroidAutoMainMethod {
    SEND_INPUT_SERVICE_TOUCH = 'send-input-service-touch',
    START = 'start',
}

export interface AndroidAutoResolution {
    width: number;
    height: number;
}

export interface AndroidAutoTouchEvent {
    event: ITouchEvent;
}

export interface AndroidAutoMainMethods {
    [AndroidAutoMainMethod.START]: () => void;
    [AndroidAutoMainMethod.SEND_INPUT_SERVICE_TOUCH]: (
        data: AndroidAutoTouchEvent,
    ) => void;
}
