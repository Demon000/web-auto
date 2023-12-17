import { VideoCodecConfig } from '@web-auto/android-auto-ipc';
import {
    DecoderWorkerMessage,
    DecoderWorkerMessageType,
} from './codec/DecoderWorkerMessages.ts';
import { androidAutoVideoService } from './ipc.ts';
import { VideoFocusMode } from '@web-auto/android-auto-proto';

export const decoderWorker = new Worker(
    new URL('./codec/DecoderWorker.ts', import.meta.url),
    {
        type: 'module',
    },
) as {
    postMessage(message: DecoderWorkerMessage, transfer?: Transferable[]): void;
};

const showProjected = async () => {
    try {
        await androidAutoVideoService.sendVideoFocusNotification({
            focus: VideoFocusMode.VIDEO_FOCUS_PROJECTED,
            unsolicited: true,
        });
    } catch (err) {
        console.error(err);
    }
};

const showNative = async () => {
    try {
        await androidAutoVideoService.sendVideoFocusNotification({
            focus: VideoFocusMode.VIDEO_FOCUS_NATIVE,
            unsolicited: true,
        });
    } catch (err) {
        console.error(err);
    }
};

const toggleFocusMode = async () => {
    await showNative();
    await showProjected();
};

const onAfterSetup = () => {
    showProjected()
        .then(() => {})
        .catch((err) => {
            console.error('Failed to show projection mode', err);
        });
};

const onFirstFrameData = (buffer: Uint8Array) => {
    decoderWorker.postMessage({
        type: DecoderWorkerMessageType.DECODE_KEYFRAME,
        data: buffer,
    });
};

const onFrameData = (buffer: Uint8Array) => {
    decoderWorker.postMessage({
        type: DecoderWorkerMessageType.DECODE_DELTA,
        data: buffer,
    });
};

const onStop = () => {
    decoderWorker.postMessage({
        type: DecoderWorkerMessageType.RESET_DECODER,
    });
};

const onCodecConfig = (data: VideoCodecConfig) => {
    decoderWorker.postMessage({
        type: DecoderWorkerMessageType.CONFIGURE_DECODER,
        codec: data.codec,
    });

    androidAutoVideoService.on('firstFrame', onFirstFrameData);
    androidAutoVideoService.on('data', onFrameData);
    androidAutoVideoService.on('stop', onStop);
};

androidAutoVideoService.isSetup().then((isSetup) => {
    if (isSetup) {
        toggleFocusMode()
            .then(() => {})
            .catch((err) => {
                console.error('Failed to toggle focus mode', err);
            });
    }
});

androidAutoVideoService.on('afterSetup', onAfterSetup);
androidAutoVideoService.on('codecConfig', onCodecConfig);
