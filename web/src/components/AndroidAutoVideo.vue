<script setup lang="ts">
import {
    H264WebCodecsDecoderEvent,
    type VideoDimensions,
} from '../codec/H264WebCodecsDecoder';
import { androidAutoInputService, androidAutoVideoService } from '../ipc.js';
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { transformFittedPoint } from 'object-fit-math';
import type { FitMode } from 'object-fit-math/dist/types.d.ts';
import { decoder } from '../codec/index.js';
import { PointerAction } from '@web-auto/android-auto-proto';

let marginHeight = 0;
let marginWidth = 0;
let marginVertical = 0;
let marginHorizontal = 0;

androidAutoVideoService
    .getVideoConfig()
    .then((config) => {
        if (
            config.heightMargin === undefined ||
            config.widthMargin === undefined
        ) {
            return;
        }
        marginHeight = config.heightMargin;
        marginWidth = config.widthMargin;
        marginVertical = Math.floor(marginHeight / 2);
        marginHorizontal = Math.floor(marginWidth / 2);
    })
    .catch((err) => {
        console.error(err);
    });

const canvasRef: Ref<HTMLCanvasElement | undefined> = ref(undefined);

let context: CanvasRenderingContext2D | undefined | null;
let canvasPosition: { x: number; y: number } = { x: 0, y: 0 };
let canvasObserver: ResizeObserver | undefined;
let canvasSize: { width: number; height: number } = { width: 0, height: 0 };
let canvasRealSize: { width: number; height: number } = { width: 0, height: 0 };
let canvasObjectFit: FitMode = 'contain';
let canvasObjectPosition: [string, string] = ['0', '0'];

function assert(conditional: boolean, message?: string): asserts conditional {
    if (!conditional) throw new Error(message);
}

const setCanvasObjectPosition = () => {
    assert(context !== undefined && context !== null);

    const canvas = context.canvas;

    const { objectPosition } = getComputedStyle(canvas);
    const objectPositionSplit = objectPosition.split(' ');
    assert(objectPositionSplit.length === 2);
    canvasObjectPosition = objectPositionSplit as [string, string];
};

const setCanvasSize = () => {
    assert(context !== undefined && context !== null);
    const canvas = context.canvas;

    const canvasBoundingBox = canvas.getBoundingClientRect();
    canvasSize.width = canvasBoundingBox.width;
    canvasSize.height = canvasBoundingBox.height;
    canvasPosition.x = canvasBoundingBox.left;
    canvasPosition.y = canvasBoundingBox.top;

    setCanvasObjectPosition();
};

const setCanvasRealSize = () => {
    assert(context !== undefined && context !== null);
    const canvas = context.canvas;

    canvasRealSize.width = canvas.width;
    canvasRealSize.height = canvas.height;
};

const onDecoderFrame = (data?: VideoFrame) => {
    try {
        assert(context !== undefined && context !== null);

        const canvas = context.canvas;

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
    } catch (err) {
        console.error(err);
    }
};

const onDecoderDimensions = (data: VideoDimensions) => {
    assert(context !== undefined && context !== null);
    const canvas = context.canvas;

    canvas.width = data.width - marginWidth;
    canvas.height = data.height - marginHeight;

    setCanvasRealSize();
};

onMounted(() => {
    const canvas = canvasRef.value;
    assert(canvas !== undefined);

    context = canvas.getContext('2d');
    assert(context !== null);

    canvasObserver = new ResizeObserver(setCanvasSize);
    canvasObserver.observe(canvas);

    decoder.emitter.on(H264WebCodecsDecoderEvent.FRAME, onDecoderFrame);
    decoder.emitter.on(
        H264WebCodecsDecoderEvent.DIMENSIONS,
        onDecoderDimensions,
    );

    if (decoder.dimensions !== undefined) {
        onDecoderDimensions(decoder.dimensions);
    }

    if (decoder.lastFrame !== undefined) {
        onDecoderFrame(decoder.lastFrame);
    }
});

onBeforeUnmount(() => {
    decoder.emitter.off(H264WebCodecsDecoderEvent.FRAME, onDecoderFrame);
    decoder.emitter.off(
        H264WebCodecsDecoderEvent.DIMENSIONS,
        onDecoderDimensions,
    );

    assert(canvasObserver !== undefined);
    canvasObserver.disconnect();
});

const translateCanvasPosition = (x: number, y: number): [number, number] => {
    const canvas = canvasRef.value;
    assert(canvas !== undefined);

    x = x - canvasPosition.x;
    y = y - canvasPosition.y;

    const translatedPoint = transformFittedPoint(
        { x, y },
        canvasSize,
        canvasRealSize,
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
    if (x < 0 || y < 0) {
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
    <div class="android-auto-video">
        <canvas
            ref="canvasRef"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @pointerout="onPointerUp"
            @pointerleave="onPointerUp"
        ></canvas>
    </div>
</template>

<style scoped>
.android-auto-video {
    width: 100%;
    height: 100%;
    background: #000;
}
canvas {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: v-bind('canvasObjectFit');
}
</style>
