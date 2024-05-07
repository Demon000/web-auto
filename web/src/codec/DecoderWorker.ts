import { VideoCodecConfig } from '@web-auto/android-auto-ipc';
import { Canvas2DRenderer } from './Canvas2DRenderer.js';
import {
    DecoderWorkerMessageType,
    DecoderWorkerMessage,
    DecoderWorkerRenderer,
} from './DecoderWorkerMessages.js';
import { Renderer } from './Renderer.js';
import { WebGLRenderer } from './WebGLRenderer.js';

const cookieRendererMap = new Map<bigint, Renderer>();
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

const renderFrame = async (frame: VideoFrame): Promise<void> => {
    const promises = Array.from(cookieRendererMap.values(), (renderer) => {
        return renderer.draw(frame).catch((err) => {
            console.error('Failed to render last frame', err);
        });
    });

    await Promise.all(promises);
};

const renderPendingFrame = (): void => {
    const frame = pendingFrame;
    if (frame === null) {
        return;
    }

    if (lastFrame !== null) {
        lastFrame.close();
    }

    lastFrame = frame;
    pendingFrame = null;

    renderFrame(frame).finally(() => {});
};

const renderLastFrame = (renderer: Renderer): void => {
    if (lastFrame === null) {
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
    cookie: bigint,
): void => {
    let renderer = cookieRendererMap.get(cookie);

    if (renderer !== undefined) {
        console.error(`Renderer with cookie ${cookie} already exists found`);
    }

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

    cookieRendererMap.set(cookie, renderer);
    renderer.setConfig(config);
    renderLastFrame(renderer);
};

const destroyRenderer = (cookie: bigint): void => {
    const renderer = cookieRendererMap.get(cookie);
    if (renderer === undefined) {
        console.error(`Renderer with cookie ${cookie} not found`);
        return;
    }

    renderer.free();
    cookieRendererMap.delete(cookie);
};

const setRenderersConfig = (config: VideoCodecConfig): void => {
    for (const renderer of cookieRendererMap.values()) {
        renderer.setConfig(config);
    }
};

const checkAcceleration = (codec: string): void => {
    if ('isConfigSupported' in VideoDecoder) {
        const hardwareAccelerations: HardwareAcceleration[] = [
            'prefer-hardware',
            'prefer-software',
        ];

        for (const hardwareAcceleration of hardwareAccelerations) {
            VideoDecoder.isConfigSupported({
                codec,
                hardwareAcceleration,
            })
                .then((support: VideoDecoderSupport) => {
                    const supported = support.supported
                        ? 'supported'
                        : 'unsupported';
                    console.log(
                        `VideoDecoder ${codec} ${hardwareAcceleration} ${supported}`,
                    );
                })
                .catch((err) => {
                    console.error(err);
                });
        }
    }
};

const onMessage = (event: MessageEvent) => {
    const message = event.data as DecoderWorkerMessage;

    switch (message.type) {
        case DecoderWorkerMessageType.CREATE_RENDERER:
            createRenderer(
                message.rendererName,
                message.canvas,
                message.cookie,
            );
            break;
        case DecoderWorkerMessageType.DESTROY_RENDERER:
            destroyRenderer(message.cookie);
            break;
        case DecoderWorkerMessageType.CONFIGURE_DECODER:
            checkAcceleration(message.config.codec);
            decoder.configure({
                codec: message.config.codec,
            });
            config = message.config;
            setRenderersConfig(config);
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
