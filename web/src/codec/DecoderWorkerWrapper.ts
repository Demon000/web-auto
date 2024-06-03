import {
    AndroidAutoVideoClient,
    AndroidAutoVideoService,
    VideoCodecConfig,
} from '@web-auto/node-common/ipc.js';
import { DecoderWorkerMessageType } from './DecoderWorkerMessages.js';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';
import { ipcClientRegistry } from '../ipc.js';

export interface DecoderWorkerConfig {
    videoServiceIpcName: string;
    renderer: string;
}

export class DecoderWorker {
    private acceptData = false;
    private worker: Worker;
    private service: IpcClientHandler<
        AndroidAutoVideoClient,
        AndroidAutoVideoService
    >;

    public constructor(private config: DecoderWorkerConfig) {
        this.worker = new Worker(
            new URL('./DecoderWorker.ts', import.meta.url),
            {
                type: 'module',
            },
        );

        this.service = ipcClientRegistry.registerIpcClient<
            AndroidAutoVideoClient,
            AndroidAutoVideoService
        >(this.config.videoServiceIpcName);

        this.onChannelStart = this.onChannelStart.bind(this);
        this.onCodecConfig = this.onCodecConfig.bind(this);
        this.onFirstFrameData = this.onFirstFrameData.bind(this);
        this.onFrameData = this.onFrameData.bind(this);
        this.onChannelStop = this.onChannelStop.bind(this);
    }

    public start(): void {
        this.service.on('channelStart', this.onChannelStart);
    }

    public createRenderer(canvas: OffscreenCanvas, cookie: bigint): void {
        this.worker.postMessage(
            {
                type: DecoderWorkerMessageType.CREATE_RENDERER,
                rendererName: this.config.renderer,
                canvas: canvas,
                cookie,
            },
            [canvas],
        );
    }

    public destroyRenderer(cookie: bigint): void {
        this.worker.postMessage({
            type: DecoderWorkerMessageType.DESTROY_RENDERER,
            cookie,
        });
    }

    private onFirstFrameData(data: Uint8Array, timestamp?: bigint): void {
        this.worker.postMessage(
            {
                type: DecoderWorkerMessageType.DECODE_KEYFRAME,
                data,
                timestamp,
            },
            [data.buffer],
        );
    }

    private onFrameData(data: Uint8Array, timestamp?: bigint): void {
        if (!this.acceptData) {
            return;
        }

        this.worker.postMessage(
            {
                type: DecoderWorkerMessageType.DECODE_DELTA,
                data,
                timestamp,
            },
            [data.buffer],
        );
    }

    private onCodecConfig(config: VideoCodecConfig): void {
        this.worker.postMessage({
            type: DecoderWorkerMessageType.CONFIGURE_DECODER,
            config,
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
