import { Canvas2DRenderer } from './Canvas2DRenderer.js';
import {
    DecoderWorkerMessageType,
    DecoderWorkerMessage,
    DecoderWorkerRenderer,
} from './DecoderWorkerMessages.js';
import { Renderer } from './Renderer.js';
import { WebGLRenderer } from './WebGLRenderer.js';
import { WebGPURenderer } from './WebGPURenderer.js';

let renderer: Renderer | null = null;
let pendingFrame: VideoFrame | null = null;
let lastFrame: VideoFrame | null = null;

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
            renderer = new Canvas2DRenderer(canvas);
            break;
        case DecoderWorkerRenderer.WEBGL:
        case DecoderWorkerRenderer.WEBGL2:
            renderer = new WebGLRenderer(rendererName, canvas);
            break;
        case DecoderWorkerRenderer.WEBGPU:
            renderer = new WebGPURenderer(canvas);
            break;
        default:
            throw new Error(`Invalid renderer ${rendererName}`);
    }
};

const onMessage = (event: MessageEvent) => {
    const message = event.data as DecoderWorkerMessage;

    switch (message.type) {
        case DecoderWorkerMessageType.CREATE_RENDERER:
            createRenderer(message.rendererName, message.canvas);
            renderLastFrame();
            break;
        case DecoderWorkerMessageType.DESTROY_RENDERER:
            renderer?.free();
            renderer = null;
            break;
        case DecoderWorkerMessageType.CONFIGURE_DECODER:
            decoder.configure({
                codec: message.codec,
            });
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
