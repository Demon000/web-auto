import { ITouchEvent } from '@web-auto/android-auto-proto';

export const ANDROID_AUTO_CHANNEL_NAME = 'android-auto';

export enum AndroidAutoRendererMethod {
    VIDEO_STOP = 'video-stop',
    VIDEO_DATA = 'video-data',
    VIDEO_START = 'video-start',
}

export interface AndroidAutoRendererMethods {
    [AndroidAutoRendererMethod.VIDEO_DATA]: (buffer: Buffer) => void;
    [AndroidAutoRendererMethod.VIDEO_START]: () => void;
    [AndroidAutoRendererMethod.VIDEO_STOP]: () => void;
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
