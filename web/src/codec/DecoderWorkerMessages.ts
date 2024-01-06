import { VideoCodecConfig } from '@web-auto/android-auto-ipc';

export enum DecoderWorkerRenderer {
    _2D = '2d',
    WEBGL = 'webgl',
    WEBGL2 = 'webgl2',
    WEBGPU = 'webgpu',
}

export enum DecoderWorkerMessageType {
    CREATE_RENDERER,
    CONFIGURE_DECODER,
    DECODE_KEYFRAME,
    DECODE_DELTA,
    RESET_DECODER,
}

export type DecoderWorkerMessage =
    | {
          type: DecoderWorkerMessageType.CREATE_RENDERER;
          rendererName: string;
          canvas: OffscreenCanvas;
      }
    | {
          type: DecoderWorkerMessageType.CONFIGURE_DECODER;
          config: VideoCodecConfig;
      }
    | {
          type: DecoderWorkerMessageType.DECODE_KEYFRAME;
          data: Uint8Array;
      }
    | {
          type: DecoderWorkerMessageType.DECODE_DELTA;
          data: Uint8Array;
      }
    | {
          type: DecoderWorkerMessageType.RESET_DECODER;
      };
