import { VideoCodecConfig } from '@web-auto/android-auto-ipc';
import {
    DecoderWorkerMessage,
    DecoderWorkerMessageType,
} from './codec/DecoderWorkerMessages.ts';
import { androidAutoVideoService } from './ipc.ts';
import { VideoFocusMode } from '@web-auto/android-auto-proto';

let acceptData = false;

export const decoderWorker = new Worker(
    new URL('./codec/DecoderWorker.ts', import.meta.url),
    {
        type: 'module',
    },
) as {
    postMessage(message: DecoderWorkerMessage, transfer?: Transferable[]): void;
};

export const setFocusMode = async (focus: VideoFocusMode) => {
    try {
        await androidAutoVideoService.sendVideoFocusNotification({
            focus,
            unsolicited: true,
        });
    } catch (err) {
        console.error(err);
    }
};

export const showProjected = async () => {
    await setFocusMode(VideoFocusMode.VIDEO_FOCUS_PROJECTED);
};

export const showNative = async () => {
    await setFocusMode(VideoFocusMode.VIDEO_FOCUS_NATIVE);
};

const toggleFocusMode = async () => {
    await showNative();
    await showProjected();
};

export const toggleFocusModeIfChannelStarted = async () => {
    try {
        const channelStarted =
            await androidAutoVideoService.getChannelStarted();
        if (channelStarted) {
            await toggleFocusMode();
        }
    } catch (err) {
        console.error(err);
    }
};

const onFirstFrameData = (buffer: Uint8Array) => {
    decoderWorker.postMessage({
        type: DecoderWorkerMessageType.DECODE_KEYFRAME,
        data: buffer,
    });
};

const onFrameData = (buffer: Uint8Array) => {
    if (!acceptData) {
        return;
    }

    decoderWorker.postMessage({
        type: DecoderWorkerMessageType.DECODE_DELTA,
        data: buffer,
    });
};

const onCodecConfig = (data: VideoCodecConfig) => {
    decoderWorker.postMessage({
        type: DecoderWorkerMessageType.CONFIGURE_DECODER,
        codec: data.codec,
    });
};

const onChannelStop = () => {
    acceptData = false;

    decoderWorker.postMessage({
        type: DecoderWorkerMessageType.RESET_DECODER,
    });

    androidAutoVideoService.off('codecConfig', onCodecConfig);
    androidAutoVideoService.off('firstFrame', onFirstFrameData);
    androidAutoVideoService.off('data', onFrameData);
    androidAutoVideoService.off('channelStop', onChannelStop);
};

const onChannelStart = () => {
    acceptData = true;

    androidAutoVideoService.on('codecConfig', onCodecConfig);
    androidAutoVideoService.on('firstFrame', onFirstFrameData);
    androidAutoVideoService.on('data', onFrameData);
    androidAutoVideoService.on('channelStop', onChannelStop);
};

androidAutoVideoService.on('channelStart', onChannelStart);
