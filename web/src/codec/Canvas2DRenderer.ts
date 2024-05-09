import { Renderer } from './Renderer.js';
import { VideoCodecConfig } from '@web-auto/node-common/ipc.js';

export class Canvas2DRenderer implements Renderer {
    private context: OffscreenCanvasRenderingContext2D;

    public constructor(
        private canvas: OffscreenCanvas,
        private config: VideoCodecConfig,
    ) {
        const context = canvas.getContext('2d');
        if (context === null) {
            throw new Error('Failed to create canvas context');
        }

        this.context = context;

        this.setConfig(config);
    }

    public setConfig(config: VideoCodecConfig): void {
        this.config = config;
        this.canvas.width = config.croppedWidth;
        this.canvas.height = config.croppedHeight;
    }

    public async draw(frame: VideoFrame): Promise<void> {
        this.context.drawImage(
            frame,
            this.config.margins.left,
            this.config.margins.top,
            this.config.width,
            this.config.height,
            0,
            0,
            this.config.width,
            this.config.height,
        );
    }

    public free(): void {}
}
