<script setup lang="ts">
import { H264WebCodecsDecoderEvent } from '../codec/H264WebCodecsDecoder';
import { androidAutoInputService, androidAutoVideoService } from '../ipc.js';
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { transformFittedPoint } from 'object-fit-math';
import type { FitMode } from 'object-fit-math/dist/types.d.ts';
import { decoder } from '../codec/index.js';
import { PointerAction, VideoFocusMode } from '@web-auto/android-auto-proto';
import { VideoCodecConfig } from '@web-auto/android-auto-ipc';

let marginHeight = 0;
let marginWidth = 0;
let marginVertical = 0;
let marginHorizontal = 0;

const canvasRef: Ref<HTMLCanvasElement | undefined> = ref(undefined);
let context: CanvasRenderingContext2D | undefined;
let canvasObserver: ResizeObserver | undefined;

let canvasPosition: { x: number; y: number } = { x: 0, y: 0 };
let canvasSize: { width: number; height: number } = { width: 0, height: 0 };
let canvasObjectFit: FitMode = 'contain';
let canvasObjectPosition: [string, string] = ['0', '0'];

function assert(conditional: boolean, message?: string): asserts conditional {
    if (!conditional) throw new Error(message);
}

const getContext = () => {
    assert(context !== undefined && context !== null);
    return context;
};

const getCanvas = () => {
    return getContext().canvas;
};

const onCanvasResized = () => {
    const canvas = getCanvas();

    const canvasBoundingBox = canvas.getBoundingClientRect();

    canvasSize.width = canvasBoundingBox.width;
    canvasSize.height = canvasBoundingBox.height;

    canvasPosition.x = canvasBoundingBox.left;
    canvasPosition.y = canvasBoundingBox.top;

    const { objectPosition } = getComputedStyle(canvas);
    const objectPositionSplit = objectPosition.split(' ');
    if (objectPositionSplit.length !== 2) {
        return;
    }
    canvasObjectPosition = objectPositionSplit as [string, string];
};

const onCodecConfig = (data: VideoCodecConfig) => {
    const canvas = getCanvas();

    canvas.width = data.width - marginWidth;
    canvas.height = data.height - marginHeight;

    decoder.emitter.on(H264WebCodecsDecoderEvent.FRAME, onDecoderFrame);
};

const onDecoderFrame = (data?: VideoFrame) => {
    const context = getContext();
    const canvas = getCanvas();

    if (data === undefined) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    context.drawImage(
        data,
        marginHorizontal,
        marginVertical,
        canvas.width,
        canvas.height,
        0,
        0,
        canvas.width,
        canvas.height,
    );
};

const showProjection = async () => {
    await androidAutoVideoService.sendVideoFocusNotification({
        focus: VideoFocusMode.VIDEO_FOCUS_PROJECTED,
        unsolicited: true,
    });
};

const showNative = async () => {
    await androidAutoVideoService.sendVideoFocusNotification({
        focus: VideoFocusMode.VIDEO_FOCUS_NATIVE,
        unsolicited: true,
    });
};

const onAfterSetup = async () => {
    await showProjection();
};

onMounted(async () => {
    const canvas = canvasRef.value;
    assert(canvas !== undefined);

    const localContext = canvas.getContext('2d');
    assert(localContext !== null);

    context = localContext;

    canvasObserver = new ResizeObserver(onCanvasResized);
    canvasObserver.observe(canvas);

    const videoConfig = await androidAutoVideoService.getVideoConfig();
    marginHeight = videoConfig.heightMargin ?? 0;
    marginWidth = videoConfig.widthMargin ?? 0;
    marginVertical = Math.floor(marginHeight / 2);
    marginHorizontal = Math.floor(marginWidth / 2);

    const isSetup = await androidAutoVideoService.isSetup();
    if (isSetup) {
        await showNative();
    }

    await showProjection();

    androidAutoVideoService.on('afterSetup', onAfterSetup);
    androidAutoVideoService.on('codecConfig', onCodecConfig);
});

onBeforeUnmount(async () => {
    onDecoderFrame(undefined);

    decoder.emitter.off(H264WebCodecsDecoderEvent.FRAME, onDecoderFrame);
    androidAutoVideoService.off('codecConfig', onCodecConfig);
    androidAutoVideoService.off('afterSetup', onAfterSetup);

    assert(canvasObserver !== undefined);
    canvasObserver.disconnect();

    await showNative();
});

const translateCanvasPosition = (x: number, y: number): [number, number] => {
    const canvas = getCanvas();

    x = x - canvasPosition.x;
    y = y - canvasPosition.y;

    const translatedPoint = transformFittedPoint(
        { x, y },
        canvasSize,
        {
            width: canvas.width,
            height: canvas.height,
        },
        canvasObjectFit,
        canvasObjectPosition[0],
        canvasObjectPosition[1],
    );

    return [Math.round(translatedPoint.x), Math.round(translatedPoint.y)];
};

const pointerMap = new Map<number, true>();

const sendPointerEvent = (event: PointerEvent) => {
    let action;

    switch (event.type) {
        case 'pointerdown':
            action = PointerAction.ACTION_POINTER_DOWN;
            break;
        case 'pointermove':
            action = PointerAction.ACTION_MOVED;
            break;
        case 'pointerup':
        case 'pointercancel':
        case 'pointerout':
        case 'pointerleave':
            action = PointerAction.ACTION_POINTER_UP;
            break;
    }

    if (action === undefined) {
        console.error('Unhandled event', event);
        return;
    }

    const [x, y] = translateCanvasPosition(event.x, event.y);
    if (isNaN(x) || isNaN(y) || x < 0 || y < 0) {
        return;
    }
    androidAutoInputService.sendTouchEvent({
        action,
        actionIndex: 0,
        pointerData: [
            {
                x,
                y,
                pointerId: event.pointerId,
            },
        ],
    });
};

const onPointerDown = (event: PointerEvent) => {
    if (pointerMap.has(event.pointerId)) {
        return;
    }

    pointerMap.set(event.pointerId, true);

    sendPointerEvent(event);
};
const onPointerMove = (event: PointerEvent) => {
    if (!pointerMap.has(event.pointerId)) {
        return;
    }

    sendPointerEvent(event);
};
const onPointerUp = (event: PointerEvent) => {
    if (!pointerMap.has(event.pointerId)) {
        return;
    }

    sendPointerEvent(event);

    pointerMap.delete(event.pointerId);
};
</script>

<template>
    <canvas
        ref="canvasRef"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerout="onPointerUp"
        @pointerleave="onPointerUp"
    ></canvas>
</template>

<style scoped>
canvas {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: v-bind('canvasObjectFit');
}
</style>
