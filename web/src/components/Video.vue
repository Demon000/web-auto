<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { transformFittedPoint } from 'object-fit-math';
import type { FitMode } from 'object-fit-math/dist/types.d.ts';
import { PointerAction } from '@web-auto/android-auto-proto';
import { ITouchEvent } from '@web-auto/android-auto-proto/interfaces.js';
import { objectId } from '../utils/objectId.js';

export interface VideoProps {
    touch: boolean;
    throttlePixels?: number;
}

const props = defineProps<VideoProps>();

const emit = defineEmits<{
    (
        e: 'video-visible',
        offscreenCanvas: OffscreenCanvas,
        cookie: bigint,
    ): void;
    (e: 'video-hidden', cookie: bigint): void;
    (e: 'touch-event', touchEvent: ITouchEvent): void;
}>();

const canvasRef: Ref<HTMLCanvasElement | undefined> = ref(undefined);
let canvasCookie: bigint | undefined;
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

    canvasCookie = objectId(canvas);

    canvasObserver = new ResizeObserver(onCanvasResized);
    canvasObserver.observe(canvas);

    const offscreenCanvas = canvas.transferControlToOffscreen();

    emit('video-visible', offscreenCanvas, canvasCookie);
});

onBeforeUnmount(() => {
    if (canvasCookie !== undefined) {
        emit('video-hidden', canvasCookie);
    }

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

const pointerTranslationMap = new Map<number, number>();
const pointerPositionMap = new Map<number, [number, number]>();

const newTranslatedPointerId = (): number => {
    const translatedPointerIds = new Set(pointerTranslationMap.values());
    let translatedPointerId = 0;
    while (true) {
        if (!translatedPointerIds.has(translatedPointerId)) break;

        translatedPointerId++;
    }

    return translatedPointerId;
};

const sendPointerEvent = (eventPointerId: number, event: PointerEvent) => {
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

    let x = Math.round(event.x);
    let y = Math.round(event.y);

    [x, y] = translateCanvasPosition(canvas, event.x, event.y);
    if (isNaN(x) || isNaN(y) || x < 0 || y < 0) {
        return;
    }

    const oldCoords = pointerPositionMap.get(eventPointerId);
    if (
        action === PointerAction.ACTION_MOVED &&
        oldCoords !== undefined &&
        props.throttlePixels !== undefined &&
        Math.abs(x - oldCoords[0]) < props.throttlePixels &&
        Math.abs(y - oldCoords[1]) < props.throttlePixels
    ) {
        return;
    }

    if (
        action === PointerAction.ACTION_POINTER_DOWN ||
        action === PointerAction.ACTION_MOVED
    ) {
        pointerPositionMap.set(eventPointerId, [x, y]);
    }

    const touchEvent: ITouchEvent = {
        action,
        pointerData: [],
    };

    for (const [pointerId, [x, y]] of pointerPositionMap) {
        if (eventPointerId === pointerId) {
            touchEvent.actionIndex = touchEvent.pointerData.length;
        }

        touchEvent.pointerData.push({
            x,
            y,
            pointerId: pointerId,
        });
    }

    if (action === PointerAction.ACTION_POINTER_UP) {
        pointerPositionMap.delete(eventPointerId);
    }

    emit('touch-event', touchEvent);
};

const onPointerDown = (event: PointerEvent) => {
    if (pointerTranslationMap.has(event.pointerId)) {
        return;
    }

    if (event.button !== 0) {
        return;
    }

    const translatedPointerId = newTranslatedPointerId();

    pointerTranslationMap.set(event.pointerId, translatedPointerId);

    sendPointerEvent(translatedPointerId, event);
};
const onPointerMove = (event: PointerEvent) => {
    const translatedPointerId = pointerTranslationMap.get(event.pointerId);

    if (translatedPointerId === undefined) {
        return;
    }

    sendPointerEvent(translatedPointerId, event);
};
const onPointerUp = (event: PointerEvent) => {
    const translatedPointerId = pointerTranslationMap.get(event.pointerId);

    if (translatedPointerId === undefined) {
        return;
    }

    sendPointerEvent(translatedPointerId, event);

    pointerTranslationMap.delete(event.pointerId);
};
</script>

<template>
    <canvas
        ref="canvasRef"
        v-if="touch"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerout="onPointerUp"
        @pointerleave="onPointerUp"
    ></canvas>
    <canvas ref="canvasRef" v-else></canvas>
</template>

<style scoped>
canvas {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: v-bind('canvasObjectFit');
}
</style>
