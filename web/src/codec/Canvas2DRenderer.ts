import { Renderer } from './Renderer.js';

export class Canvas2DRenderer implements Renderer {
    private context: OffscreenCanvasRenderingContext2D;

    public constructor(private canvas: OffscreenCanvas) {
        const context = canvas.getContext('2d');
        if (context === null) {
            throw new Error('Failed to create canvas context');
        }

        this.context = context;
    }

    public async draw(frame: VideoFrame): Promise<void> {
        this.canvas.width = frame.displayWidth;
        this.canvas.height = frame.displayHeight;

        this.context.drawImage(
            frame,
            0,
            0,
            frame.displayWidth,
            frame.displayHeight,
        );
    }

    public free(): void {}
}
