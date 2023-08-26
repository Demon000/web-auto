<script setup lang="ts">
import {
    H264WebCodecsDecoder,
    H264WebCodecsDecoderEvent,
} from '@/codec/H264WebCodecsDecoder';
import { androidAutoChannel } from '@/ipc/channels';
import { AndroidAutoMainMethod } from '@web-auto/electron-ipc-android-auto';
import { AndroidAutoRendererMethod } from '@web-auto/electron-ipc-android-auto';
import { onMounted, ref, type Ref } from 'vue';
import { transformFittedPoint } from 'object-fit-math';
import { TouchAction } from '@web-auto/android-auto-proto';

const canvasRef: Ref<HTMLCanvasElement | undefined> = ref(undefined);
let canvasRealSize: { width: number; height: number } = { width: 0, height: 0 };
let canvasSize: { width: number; height: number } = { width: 0, height: 0 };

const setCanvasSizes = () => {
    const canvas = canvasRef.value;
    if (canvas === undefined) {
        return;
    }

    canvasRealSize.width = canvas.width;
    canvasRealSize.height = canvas.height;

    const canvasBoundingBox = canvas.getBoundingClientRect();
    canvasSize.width = canvasBoundingBox.width;
    canvasSize.height = canvasBoundingBox.height;

    console.log(canvasRealSize, canvasSize);
};

onMounted(() => {
    const canvas = canvasRef.value;
    if (canvas === undefined) {
        return;
    }

    const context = canvas.getContext('2d');
    if (context === null) {
        return;
    }

    const resizeObserver = new ResizeObserver(setCanvasSizes);
    resizeObserver.observe(canvas);

    const decoder = new H264WebCodecsDecoder(canvas);

    decoder.emitter.on(H264WebCodecsDecoderEvent.DIMENSIONS, (data) => {
        canvas.width = data.width;
        canvas.height = data.height;
        setCanvasSizes();
    });

    decoder.emitter.on(H264WebCodecsDecoderEvent.FRAME, (data) => {
        context.drawImage(data, 0, 0);
    });

    androidAutoChannel.on(AndroidAutoRendererMethod.VIDEO_DATA, (buffer) => {
        decoder.decode(buffer);
    });

    androidAutoChannel.send(AndroidAutoMainMethod.START);
});

const onCanvasClick = (event: MouseEvent) => {
    const canvas = canvasRef.value;
    if (canvas === undefined) {
        return;
    }

    const { objectFit, objectPosition } = getComputedStyle(canvas);
    const [left, top] = objectPosition.split(' ');
    const { x, y } = transformFittedPoint(
        { x: event.offsetX, y: event.offsetY },
        canvasSize,
        canvas,
        objectFit as any,
        left,
        top,
    );

    androidAutoChannel.send(AndroidAutoMainMethod.SEND_INPUT_SERVICE_TOUCH, {
        event: {
            touchAction: TouchAction.Enum.PRESS,
            actionIndex: null,
            touchLocation: [
                {
                    x,
                    y,
                    pointerId: 0,
                },
            ],
        },
    });
};
</script>

<template>
    <div class="android-auto-video">
        <canvas ref="canvasRef" @click="onCanvasClick"></canvas>
    </div>
</template>

<style scoped>
canvas {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    background: #000;
}
</style>
