import { DecoderWorkerRenderer } from './DecoderWorkerMessages.js';
import { Renderer } from './Renderer.js';

type WebGLCommonRenderingContext =
    | WebGLRenderingContext
    | WebGL2RenderingContext;

export class WebGLRenderer implements Renderer {
    private context: WebGLCommonRenderingContext;

    private static vertexShaderSource = `
      attribute vec2 xy;
  
      varying highp vec2 uv;
  
      void main(void) {
        gl_Position = vec4(xy, 0.0, 1.0);
        // Map vertex coordinates (-1 to +1) to UV coordinates (0 to 1).
        // UV coordinates are Y-flipped relative to vertex coordinates.
        uv = vec2((1.0 + xy.x) / 2.0, (1.0 - xy.y) / 2.0);
      }
    `;

    private static fragmentShaderSource = `
      varying highp vec2 uv;
  
      uniform sampler2D texture;
  
      void main(void) {
        gl_FragColor = texture2D(texture, uv);
      }
    `;

    public constructor(
        type: DecoderWorkerRenderer.WEBGL | DecoderWorkerRenderer.WEBGL2,
        private canvas: OffscreenCanvas,
    ) {
        this.canvas = canvas;

        const gl = canvas.getContext(type) as WebGLCommonRenderingContext;
        if (gl === null) {
            throw new Error('Failed to create canvas context');
        }
        this.context = gl;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (vertexShader === null) {
            throw new Error('Failed to create vertex shader');
        }

        gl.shaderSource(vertexShader, WebGLRenderer.vertexShaderSource);
        gl.compileShader(vertexShader);
        const vertexShaderCompileStatus = gl.getShaderParameter(
            vertexShader,
            gl.COMPILE_STATUS,
        ) as boolean | null;
        if (vertexShaderCompileStatus === null || !vertexShaderCompileStatus) {
            throw gl.getShaderInfoLog(vertexShader);
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (fragmentShader === null) {
            throw new Error('Failed to create fragment shader');
        }

        gl.shaderSource(fragmentShader, WebGLRenderer.fragmentShaderSource);
        gl.compileShader(fragmentShader);
        const fragmentSharedCompileStatus = gl.getShaderParameter(
            fragmentShader,
            gl.COMPILE_STATUS,
        ) as boolean | null;
        if (
            fragmentSharedCompileStatus === null ||
            !fragmentSharedCompileStatus
        ) {
            throw gl.getShaderInfoLog(fragmentShader);
        }

        const shaderProgram = gl.createProgram();
        if (shaderProgram === null) {
            throw new Error('Failed to create shader program');
        }

        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        const programLinkStatus = gl.getProgramParameter(
            shaderProgram,
            gl.LINK_STATUS,
        ) as boolean | null;
        if (programLinkStatus === null || !programLinkStatus) {
            throw gl.getProgramInfoLog(shaderProgram);
        }
        gl.useProgram(shaderProgram);

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1.0, -1.0, -1.0, +1.0, +1.0, +1.0, +1.0, -1.0]),
            gl.STATIC_DRAW,
        );

        const xyLocation = gl.getAttribLocation(shaderProgram, 'xy');
        gl.vertexAttribPointer(xyLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(xyLocation);

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    public async draw(frame: VideoFrame): Promise<void> {
        this.canvas.width = frame.displayWidth;
        this.canvas.height = frame.displayHeight;

        const gl = this.context;

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            frame,
        );

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(1.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    public free(): void {
        const gl = this.context;
        const extension = gl.getExtension('WEBGL_lose_context');
        if (extension === null) {
            return;
        }

        extension.loseContext();
    }
}
