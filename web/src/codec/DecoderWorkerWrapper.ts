import {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
    VideoCodecConfig,
} from '@web-auto/android-auto-ipc';
import { DecoderWorkerMessageType } from './DecoderWorkerMessages.ts';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';

export class DecoderWorker {
    private acceptData = false;
    private worker: Worker;

    public constructor(
        private service: IpcClientHandler<
            AndroidAutoVideoClient,
            AndroidAutoVideoService
        >,
    ) {
        this.worker = new Worker(
            new URL('./DecoderWorker.ts', import.meta.url),
            {
                type: 'module',
            },
        );

        this.onChannelStart = this.onChannelStart.bind(this);
        this.onCodecConfig = this.onCodecConfig.bind(this);
        this.onFirstFrameData = this.onFirstFrameData.bind(this);
        this.onFrameData = this.onFrameData.bind(this);
        this.onChannelStop = this.onChannelStop.bind(this);
    }

    public start(): void {
        this.service.on('channelStart', this.onChannelStart);
    }

    public createRenderer(offscreenCanvas: OffscreenCanvas): void {
        this.worker.postMessage(
            {
                type: DecoderWorkerMessageType.CREATE_RENDERER,
                rendererName: import.meta.env.VITE_VIDEO_DECODER_RENDERER,
                canvas: offscreenCanvas,
            },
            [offscreenCanvas],
        );
    }

    public destroyRenderer(): void {
        this.worker.postMessage({
            type: DecoderWorkerMessageType.DESTROY_RENDERER,
        });
    }

    private onFirstFrameData(buffer: Uint8Array): void {
        this.worker.postMessage({
            type: DecoderWorkerMessageType.DECODE_KEYFRAME,
            data: buffer,
        });
    }

    private onFrameData(buffer: Uint8Array): void {
        if (!this.acceptData) {
            return;
        }

        this.worker.postMessage({
            type: DecoderWorkerMessageType.DECODE_DELTA,
            data: buffer,
        });
    }

    private onCodecConfig(data: VideoCodecConfig): void {
        this.worker.postMessage({
            type: DecoderWorkerMessageType.CONFIGURE_DECODER,
            codec: data.codec,
        });
    }

    private onChannelStop(): void {
        this.acceptData = false;

        this.worker.postMessage({
            type: DecoderWorkerMessageType.RESET_DECODER,
        });

        this.service.off('codecConfig', this.onCodecConfig);
        this.service.off('firstFrame', this.onFirstFrameData);
        this.service.off('data', this.onFrameData);
        this.service.off('channelStop', this.onChannelStop);
    }

    private onChannelStart(): void {
        this.acceptData = true;

        this.service.on('codecConfig', this.onCodecConfig);
        this.service.on('firstFrame', this.onFirstFrameData);
        this.service.on('data', this.onFrameData);
        this.service.on('channelStop', this.onChannelStop);
    }
}
