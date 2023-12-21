export enum DecoderWorkerRenderer {
    _2D = '2d',
    WEBGL = 'webgl',
    WEBGL2 = 'webgl2',
    WEBGPU = 'webgpu',
}

export enum DecoderWorkerMessageType {
    CREATE_RENDERER,
    DESTROY_RENDERER,
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
          type: DecoderWorkerMessageType.DESTROY_RENDERER;
      }
    | {
          type: DecoderWorkerMessageType.CONFIGURE_DECODER;
          codec: string;
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