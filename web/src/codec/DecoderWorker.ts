import { VideoCodecConfig } from '@web-auto/android-auto-ipc';
import { Canvas2DRenderer } from './Canvas2DRenderer.js';
import {
    DecoderWorkerMessageType,
    DecoderWorkerMessage,
    DecoderWorkerRenderer,
} from './DecoderWorkerMessages.js';
import { Renderer } from './Renderer.js';
import { WebGLRenderer } from './WebGLRenderer.js';

let renderer: Renderer | null = null;
let pendingFrame: VideoFrame | null = null;
let lastFrame: VideoFrame | null = null;
let config: VideoCodecConfig = {
    codec: '',
    croppedHeight: 0,
    croppedWidth: 0,
    width: 0,
    height: 0,
    margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
};

const renderPendingFrame = (): void => {
    if (renderer === null || pendingFrame === null) {
        return;
    }

    renderer
        .draw(pendingFrame)
        .then(() => {
            lastFrame?.close();
            lastFrame = pendingFrame;
            pendingFrame = null;
        })
        .catch((err) => {
            console.error('Failed to draw pending frame', err);
        });
};

const renderLastFrame = (): void => {
    if (renderer === null || lastFrame === null) {
        return;
    }

    renderer
        .draw(lastFrame)
        .then(() => {})
        .catch((err) => {
            console.error('Failed to draw last frame', err);
        });
};

const requestFrameRender = (frame: VideoFrame): void => {
    if (pendingFrame === null) {
        pendingFrame = frame;
        requestAnimationFrame(renderPendingFrame);
    } else {
        pendingFrame.close();
        pendingFrame = frame;
    }
};

const decoder = new VideoDecoder({
    output(frame) {
        requestFrameRender(frame);
    },
    error() {},
});

const createRenderer = (
    rendererName: string,
    canvas: OffscreenCanvas,
): void => {
    switch (rendererName) {
        case DecoderWorkerRenderer._2D:
            renderer = new Canvas2DRenderer(canvas, config);
            break;
        case DecoderWorkerRenderer.WEBGL:
        case DecoderWorkerRenderer.WEBGL2:
            renderer = new WebGLRenderer(rendererName, canvas, config);
            break;
        default:
            throw new Error(`Invalid renderer ${rendererName}`);
    }
};

const onMessage = (event: MessageEvent) => {
    const message = event.data as DecoderWorkerMessage;

    switch (message.type) {
        case DecoderWorkerMessageType.CREATE_RENDERER:
            renderer?.free();
            createRenderer(message.rendererName, message.canvas);
            renderLastFrame();
            break;
        case DecoderWorkerMessageType.CONFIGURE_DECODER:
            decoder.configure({
                codec: message.config.codec,
            });
            config = message.config;
            renderer?.setConfig(config);
            break;
        case DecoderWorkerMessageType.DECODE_KEYFRAME:
            decoder.decode(
                new EncodedVideoChunk({
                    type: 'key',
                    data: message.data,
                    timestamp: 0,
                }),
            );
            break;
        case DecoderWorkerMessageType.DECODE_DELTA:
            decoder.decode(
                new EncodedVideoChunk({
                    type: 'delta',
                    data: message.data,
                    timestamp: 0,
                }),
            );
            break;
        case DecoderWorkerMessageType.RESET_DECODER:
            decoder.reset();
            break;
    }
};

self.addEventListener('message', onMessage);
