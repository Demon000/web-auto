import { VideoCodecConfig } from '@web-auto/android-auto-ipc';

export interface Renderer {
    draw(frame: VideoFrame): Promise<void>;
    setConfig(config: VideoCodecConfig): void;
    free(): void;
}
