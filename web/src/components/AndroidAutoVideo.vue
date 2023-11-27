<script setup lang="ts">
import {
    H264WebCodecsDecoder,
    H264WebCodecsDecoderEvent,
    type VideoDimensions,
} from '@/codec/H264WebCodecsDecoder';
import { androidAutoChannel } from '@/ipc/channels';
import { webConfigChannel } from '@/ipc/channels';
import { AndroidAutoMainMethod } from '@web-auto/electron-ipc-android-auto';
import { AndroidAutoRendererMethod } from '@web-auto/electron-ipc-android-auto';
import { onMounted, ref, type Ref } from 'vue';
import { transformFittedPoint } from 'object-fit-math';
import { type FitMode } from 'object-fit-math/dist/types';
import { TouchAction } from '@web-auto/android-auto-proto';
import { WebConfigMainMethod } from '@web-auto/electron-ipc-web-config';

let marginHeight = 0;
let marginWidth = 0;
let marginVertical = 0;
let marginHorizontal = 0;

webConfigChannel
    .invoke(WebConfigMainMethod.CONFIG)
    .then((config) => {
        marginHeight = config.androidAuto?.video?.marginHeight ?? 0;
        marginWidth = config.androidAuto?.video?.marginWidth ?? 0;
        marginVertical = Math.floor(marginHeight / 2);
        marginHorizontal = Math.floor(marginWidth / 2);
    })
    .catch((err) => {
        console.error(err);
    });

const canvasRef: Ref<HTMLCanvasElement | undefined> = ref(undefined);
let canvasSize: { width: number; height: number } = { width: 0, height: 0 };
let canvasRealSize: { width: number; height: number } = { width: 0, height: 0 };
let canvasObjectFit: FitMode = 'contain';
let canvasObjectPosition: [string, string] = ['0', '0'];

function assert(conditional: boolean, message?: string): asserts conditional {
    if (!conditional) throw new Error(message);
}

const setCanvasObjectPosition = () => {
    const canvas = canvasRef.value;
    assert(canvas !== undefined);

    const { objectPosition } = getComputedStyle(canvas);
    const objectPositionSplit = objectPosition.split(' ');
    assert(objectPositionSplit.length === 2);
    canvasObjectPosition = objectPositionSplit as [string, string];
};

const setCanvasSize = () => {
    const canvas = canvasRef.value;
    assert(canvas !== undefined);

    const canvasBoundingBox = canvas.getBoundingClientRect();
    canvasSize.width = canvasBoundingBox.width;
    canvasSize.height = canvasBoundingBox.height;

    setCanvasObjectPosition();
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

    let decoder: H264WebCodecsDecoder | undefined;

    const onDecoderFrame = (data: VideoFrame) => {
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

    const onDecoderDimensions = (data: VideoDimensions) => {
        canvas.width = data.width - marginWidth;
        canvas.height = data.height - marginHeight;

        setCanvasRealSize();
    };

    androidAutoChannel.on(AndroidAutoRendererMethod.VIDEO_START, () => {
        decoder = new H264WebCodecsDecoder();

        decoder.emitter.on(H264WebCodecsDecoderEvent.FRAME, onDecoderFrame);

        decoder.emitter.on(
            H264WebCodecsDecoderEvent.DIMENSIONS,
            onDecoderDimensions,
        );
    });

    androidAutoChannel.on(AndroidAutoRendererMethod.VIDEO_DATA, (buffer) => {
        assert(decoder !== undefined);

        decoder.decode(buffer);
    });

    androidAutoChannel.on(AndroidAutoRendererMethod.VIDEO_STOP, () => {
        context.clearRect(0, 0, canvas.width, canvas.height);

        assert(decoder !== undefined);

        decoder.emitter.off(H264WebCodecsDecoderEvent.FRAME, onDecoderFrame);

        decoder.emitter.off(
            H264WebCodecsDecoderEvent.DIMENSIONS,
            onDecoderDimensions,
        );

        decoder.dispose();

        decoder = undefined;
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
