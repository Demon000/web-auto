export interface Renderer {
    draw(frame: VideoFrame): Promise<void>;
    free(): void;
}
