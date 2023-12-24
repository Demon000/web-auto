<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { transformFittedPoint } from 'object-fit-math';
import type { FitMode } from 'object-fit-math/dist/types.d.ts';
import { PointerAction } from '@web-auto/android-auto-proto';
import { ITouchEvent } from '@web-auto/android-auto-proto/interfaces.js';

const emit = defineEmits<{
    (e: 'video-visible', offscreenCanvas: OffscreenCanvas): void;
    (e: 'video-hidden'): void;
    (e: 'touch-event', touchEvent: ITouchEvent): void;
}>();

const canvasRef: Ref<HTMLCanvasElement | undefined> = ref(undefined);
let canvasObserver: ResizeObserver | undefined;

let canvasPosition: { x: number; y: number } = { x: 0, y: 0 };
let canvasSize: { width: number; height: number } = { width: 0, height: 0 };
let canvasObjectFit: FitMode = 'contain';
let canvasObjectPosition: [string, string] = ['0', '0'];

const onCanvasResized = (entries: ResizeObserverEntry[]) => {
    if (entries.length !== 1) {
        return;
    }

    const canvas = entries[0].target as HTMLCanvasElement;

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

onMounted(() => {
    const canvas = canvasRef.value;
    if (canvas === undefined) {
        return;
    }

    canvasObserver = new ResizeObserver(onCanvasResized);
    canvasObserver.observe(canvas);

    const offscreenCanvas = canvas.transferControlToOffscreen();

    emit('video-visible', offscreenCanvas);
});

onBeforeUnmount(() => {
    emit('video-hidden');

    if (canvasObserver !== undefined) {
        canvasObserver.disconnect();
    }
});

const translateCanvasPosition = (
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
): [number, number] => {
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

    const canvas = canvasRef.value;
    if (canvas === undefined) {
        return;
    }

    const [x, y] = translateCanvasPosition(canvas, event.x, event.y);
    if (isNaN(x) || isNaN(y) || x < 0 || y < 0) {
        return;
    }

    emit('touch-event', {
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

    if (event.button !== 0) {
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

    if (event.button !== 0) {
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
