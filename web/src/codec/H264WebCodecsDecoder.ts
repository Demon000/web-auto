import { EventEmitter } from 'eventemitter3';

export enum H264WebCodecsDecoderEvent {
    FRAME,
}

export interface H264WebCodecsDecoderEvents {
    [H264WebCodecsDecoderEvent.FRAME]: (data?: VideoFrame) => void;
}

export class H264WebCodecsDecoder {
    public emitter = new EventEmitter<H264WebCodecsDecoderEvents>();

    private decoder: VideoDecoder;

    private animationFrameId = 0;

    constructor() {
        this.decoder = new VideoDecoder({
            output: this.onFrame.bind(this),
            error(e) {
                console.error(e);
            },
        });

        this.onFramePresented();
    }

    private onFramePresented = () => {
        this.animationFrameId = requestAnimationFrame(this.onFramePresented);
    };

    private onFrame = (frame: VideoFrame) => {
        this.emitter.emit(H264WebCodecsDecoderEvent.FRAME, frame);
        frame.close();
    };

    configure(codec: string) {
        this.decoder.configure({
            codec,
            optimizeForLatency: true,
        });
    }

    decodeKeyFrame(data: Uint8Array) {
        this.decoder.decode(
            new EncodedVideoChunk({
                type: 'key',
                timestamp: 0,
                data,
            }),
        );
    }

    decode(data: Uint8Array) {
        this.decoder.decode(
            new EncodedVideoChunk({
                type: 'delta',
                timestamp: 0,
                data,
            }),
        );
    }

    reset() {
        cancelAnimationFrame(this.animationFrameId);
        this.decoder.reset();
    }
}
