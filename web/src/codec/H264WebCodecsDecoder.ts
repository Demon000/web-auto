import { EventEmitter } from 'eventemitter3';
import { h264ParseConfiguration } from './h264';

function toHex(value: number) {
    return value.toString(16).padStart(2, '0').toUpperCase();
}

export interface VideoDimensions {
    width: number;
    height: number;
}

export enum H264WebCodecsDecoderEvent {
    DIMENSIONS,
    FRAME,
}

export interface H264WebCodecsDecoderEvents {
    [H264WebCodecsDecoderEvent.DIMENSIONS]: (data: VideoDimensions) => void;
    [H264WebCodecsDecoderEvent.FRAME]: (data: VideoFrame) => void;
}

export class H264WebCodecsDecoder {
    public emitter = new EventEmitter<H264WebCodecsDecoderEvents>();

    private decoder: VideoDecoder;
    private configData?: Uint8Array;

    private animationFrameId = 0;

    constructor() {
        this.decoder = new VideoDecoder({
            output: (frame) => {
                // PERF: H.264 renderer may draw multiple frames in one vertical sync interval to minimize latency.
                // When multiple frames are drawn in one vertical sync interval,
                // only the last one is visible to users.
                // But this ensures users can always see the most up-to-date screen.
                // This is also the behavior of official Scrcpy client.
                // https://github.com/Genymobile/scrcpy/issues/3679
                this.emitter.emit(H264WebCodecsDecoderEvent.FRAME, frame);

                frame.close();
            },
            error(e) {
                console.error(e);
            },
        });

        this.onFramePresented();
    }

    private onFramePresented = () => {
        this.animationFrameId = requestAnimationFrame(this.onFramePresented);
    };

    configure(data: Uint8Array) {
        const {
            profileIndex,
            constraintSet,
            levelIndex,
            croppedWidth,
            croppedHeight,
        } = h264ParseConfiguration(data);

        this.emitter.emit(H264WebCodecsDecoderEvent.DIMENSIONS, {
            width: croppedWidth,
            height: croppedHeight,
        });

        // https://www.rfc-editor.org/rfc/rfc6381#section-3.3
        // ISO Base Media File Format Name Space
        const codec = `avc1.${[profileIndex, constraintSet, levelIndex]
            .map(toHex)
            .join('')}`;

        try {
            this.decoder.configure({
                codec,
                optimizeForLatency: true,
            });
        } catch (e) {
            console.error(e);
        }
    }

    decode(data: Uint8Array) {
        if (this.decoder.state !== 'configured') {
            try {
                this.configure(data);
                this.configData = data;
            } catch (e) {
                console.error(e);
            }
            return;
        }

        // WebCodecs requires configuration data to be with the first frame.
        // https://www.w3.org/TR/webcodecs-avc-codec-registration/#encodedvideochunk-type
        let isKeyframe = false;
        if (this.configData !== undefined) {
            const newData = new Uint8Array(
                this.configData.byteLength + data.byteLength,
            );
            newData.set(this.configData, 0);
            newData.set(data, this.configData.byteLength);
            data = newData;
            this.configData = undefined;
            isKeyframe = true;
        }

        try {
            this.decoder.decode(
                new EncodedVideoChunk({
                    type: isKeyframe ? 'key' : 'delta',
                    timestamp: 0,
                    data,
                }),
            );
        } catch (e) {
            console.error(e);
        }
    }

    dispose() {
        cancelAnimationFrame(this.animationFrameId);

        if (this.decoder.state !== 'closed') {
            this.decoder.close();
        }
    }
}
