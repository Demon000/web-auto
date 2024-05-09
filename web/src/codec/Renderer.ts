import { VideoCodecConfig } from '@web-auto/node-common/ipc.js';

export interface Renderer {
    draw(frame: VideoFrame): Promise<void>;
    setConfig(config: VideoCodecConfig): void;
    free(): void;
}
