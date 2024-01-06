/// <reference types="@webgpu/types" />

import { Renderer } from './Renderer.js';
import { VideoCodecConfig } from '@web-auto/android-auto-ipc';

export class WebGPURenderer implements Renderer {
    private started: Promise<void>;

    private device?: GPUDevice;
    private format?: GPUTextureFormat;
    private context?: GPUCanvasContext;
    private pipeline?: GPURenderPipeline;
    private sampler?: GPUSampler;

    private static vertexShaderSource = `
    struct VertexOutput {
        @builtin(position) Position: vec4<f32>,
        @location(0) uv: vec2<f32>,
    }

    @vertex
    fn vert_main(@builtin(vertex_index) VertexIndex: u32) -> VertexOutput {
        var pos = array<vec2<f32>, 6>(
            vec2<f32>( 1.0,  1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 1.0,  1.0),
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(-1.0,  1.0)
        );

        var uv = array<vec2<f32>, 6>(
            vec2<f32>(1.0, 0.0),
            vec2<f32>(1.0, 1.0),
            vec2<f32>(0.0, 1.0),
            vec2<f32>(1.0, 0.0),
            vec2<f32>(0.0, 1.0),
            vec2<f32>(0.0, 0.0)
        );

        var output : VertexOutput;
        output.Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
        output.uv = uv[VertexIndex];
        return output;
    }
    `;

    private static fragmentShaderSource = `
        @group(0) @binding(1) var mySampler: sampler;
        @group(0) @binding(2) var myTexture: texture_external;

        @fragment
        fn frag_main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
            return textureSampleBaseClampToEdge(myTexture, mySampler, uv);
        }
    `;

    public constructor(
        private canvas: OffscreenCanvas,
        private config: VideoCodecConfig,
    ) {
        this.started = this.start();

        this.setConfig(config);
    }

    private async start(): Promise<void> {
        this.format = navigator.gpu.getPreferredCanvasFormat();

        const context = this.canvas.getContext('webgpu');
        if (context === null) {
            throw new Error('Failed to create context');
        }

        this.context = context;

        const adapter = await navigator.gpu.requestAdapter();
        if (adapter === null) {
            throw new Error('Failed to request adapter');
        }

        this.device = await adapter.requestDevice();

        context.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'opaque',
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: this.device.createShaderModule({
                    code: WebGPURenderer.vertexShaderSource,
                }),
                entryPoint: 'vert_main',
            },
            fragment: {
                module: this.device.createShaderModule({
                    code: WebGPURenderer.fragmentShaderSource,
                }),
                entryPoint: 'frag_main',
                targets: [{ format: this.format }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        this.sampler = this.device.createSampler({});
    }

    public setConfig(config: VideoCodecConfig): void {
        this.config = config;
        this.canvas.width = this.config.croppedWidth;
        this.canvas.height = this.config.croppedHeight;
    }

    public async draw(frame: VideoFrame) {
        await this.started;

        if (
            this.device === undefined ||
            this.pipeline === undefined ||
            this.sampler === undefined ||
            this.context === undefined
        ) {
            throw new Error('Failed to start');
        }

        const uniformBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 1, resource: this.sampler },
                {
                    binding: 2,
                    resource: this.device.importExternalTexture({
                        source: frame,
                    }),
                },
            ],
        });

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: [1.0, 0.0, 0.0, 1.0],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, uniformBindGroup);
        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    public free(): void {}
}
