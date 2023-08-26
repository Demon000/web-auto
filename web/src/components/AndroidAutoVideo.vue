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
import { type FitMode } from 'object-fit-math/dist/types';
import { TouchAction } from '@web-auto/android-auto-proto';

const canvasRef: Ref<HTMLCanvasElement | undefined> = ref(undefined);
let canvasSize: { width: number; height: number } = { width: 0, height: 0 };
let canvasRealSize: { width: number; height: number } = { width: 0, height: 0 };
let canvasObjectFit: FitMode = 'contain';
let canvasObjectPosition: [string, string] = ['0', '0'];

function assert(conditional: boolean, message?: string): asserts conditional {
    if (!conditional) throw new Error(message);
}

const setCanvasSize = () => {
    const canvas = canvasRef.value;
    assert(canvas !== undefined);

    const canvasBoundingBox = canvas.getBoundingClientRect();
    canvasSize.width = canvasBoundingBox.width;
    canvasSize.height = canvasBoundingBox.height;
};

const setCanvasRealSize = () => {
    const canvas = canvasRef.value;
    assert(canvas !== undefined);

    canvasRealSize.width = canvas.width;
    canvasRealSize.height = canvas.height;
};

onMounted(() => {
    const canvas = canvasRef.value;
    assert(canvas !== undefined);

    const context = canvas.getContext('2d');
    assert(context !== null);

    new ResizeObserver(setCanvasSize).observe(canvas);

    const decoder = new H264WebCodecsDecoder(canvas);

    decoder.emitter.on(H264WebCodecsDecoderEvent.DIMENSIONS, (data) => {
        canvas.width = data.width;
        canvas.height = data.height;

        setCanvasRealSize();
    });

    decoder.emitter.on(H264WebCodecsDecoderEvent.FRAME, (data) => {
        context.drawImage(data, 0, 0);
    });

    androidAutoChannel.on(AndroidAutoRendererMethod.VIDEO_DATA, (buffer) => {
        decoder.decode(buffer);
    });

    androidAutoChannel.send(AndroidAutoMainMethod.START);
});

const translateCanvasPosition = (x: number, y: number): [number, number] => {
    const canvas = canvasRef.value;
    assert(canvas !== undefined);

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

const onCanvasClick = (event: MouseEvent) => {
    const [x, y] = translateCanvasPosition(event.x, event.y);

    let data = {
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
    };
    androidAutoChannel.send(
        AndroidAutoMainMethod.SEND_INPUT_SERVICE_TOUCH,
        data,
    );

    data.event.touchAction = TouchAction.Enum.RELEASE;

    androidAutoChannel.send(
        AndroidAutoMainMethod.SEND_INPUT_SERVICE_TOUCH,
        data,
    );
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
    object-fit: v-bind('canvasObjectFit');
    background: #000;
}
</style>
