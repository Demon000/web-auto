export interface H264WebCodecsDecoderEvents {
    onFrame: (data?: VideoFrame) => void;
}

export class H264WebCodecsDecoder {
    private decoder: VideoDecoder;

    private animationFrameId = 0;

    constructor(private events: H264WebCodecsDecoderEvents) {
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
        this.events.onFrame(frame);
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
        /* TODO: fix me */
        if (this.decoder.state !== 'configured') {
            return;
        }

        this.decoder.decode(
            new EncodedVideoChunk({
                type: 'delta',
                timestamp: 0,
                data,
            }),
        );
    }

    reset() {
        this.events.onFrame(undefined);
        cancelAnimationFrame(this.animationFrameId);
        this.decoder.reset();
    }
}
