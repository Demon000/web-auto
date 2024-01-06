import { DecoderWorkerRenderer } from './DecoderWorkerMessages.js';
import { Renderer } from './Renderer.js';
import { orthographic, scale, translate, translation } from './m4.js';
import { VideoCodecConfig } from '@web-auto/android-auto-ipc';

type WebGLCommonRenderingContext =
    | WebGLRenderingContext
    | WebGL2RenderingContext;

export class WebGLRenderer implements Renderer {
    private context: WebGLCommonRenderingContext;

    private static vertexShaderSource = `
        attribute vec4 a_position;
        attribute vec2 a_texcoord;

        uniform mat4 u_matrix;
        uniform mat4 u_textureMatrix;

        varying vec2 v_texcoord;

        void main() {
            gl_Position = u_matrix * a_position;
            v_texcoord = (u_textureMatrix * vec4(a_texcoord, 0, 1)).xy;
        }
    `;

    private static fragmentShaderSource = `
        precision mediump float;

        varying vec2 v_texcoord;

        uniform sampler2D u_texture;

        void main() {
            gl_FragColor = texture2D(u_texture, v_texcoord);
        }
    `;

    private matrixLocation: WebGLUniformLocation | null;
    private textureMatrixLocation: WebGLUniformLocation | null;

    public constructor(
        type: DecoderWorkerRenderer.WEBGL | DecoderWorkerRenderer.WEBGL2,
        private canvas: OffscreenCanvas,
        private config: VideoCodecConfig,
    ) {
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

        const positionLocation = gl.getAttribLocation(
            shaderProgram,
            'a_position',
        );
        const texcoordLocation = gl.getAttribLocation(
            shaderProgram,
            'a_texcoord',
        );

        this.matrixLocation = gl.getUniformLocation(shaderProgram, 'u_matrix');
        this.textureMatrixLocation = gl.getUniformLocation(
            shaderProgram,
            'u_textureMatrix',
        );
        const textureLocation = gl.getUniformLocation(
            shaderProgram,
            'u_texture',
        );
        gl.uniform1i(textureLocation, 0);

        const positionBuffer = gl.createBuffer();
        if (positionBuffer === null) {
            throw new Error('Failed to create position buffer');
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]),
            gl.STATIC_DRAW,
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const texcoordBuffer = gl.createBuffer();
        if (texcoordBuffer === null) {
            throw new Error('Failed to create texture coordinates buffer');
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]),
            gl.STATIC_DRAW,
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        gl.enableVertexAttribArray(texcoordLocation);
        gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.setConfig(config);
    }

    public setConfig(config: VideoCodecConfig): void {
        this.config = config;

        if (
            this.config.width === 0 ||
            this.config.height === 0 ||
            this.config.croppedWidth === 0 ||
            this.config.croppedHeight === 0
        ) {
            return;
        }

        this.canvas.width = this.config.croppedWidth;
        this.canvas.height = this.config.croppedHeight;

        const gl = this.context;

        gl.viewport(0, 0, this.config.croppedWidth, this.config.croppedHeight);

        let matrix;

        matrix = orthographic(
            0,
            this.config.croppedWidth,
            this.config.croppedHeight,
            0,
            -1,
            1,
        );
        matrix = translate(matrix, 0, 0, 0);
        matrix = scale(
            matrix,
            this.config.croppedWidth,
            this.config.croppedHeight,
            1,
        );

        gl.uniformMatrix4fv(this.matrixLocation, false, matrix);

        let texMatrix;

        texMatrix = translation(
            this.config.margins.left / this.config.width,
            this.config.margins.top / this.config.height,
            0,
        );
        texMatrix = scale(
            texMatrix,
            this.config.croppedWidth / this.config.width,
            this.config.croppedHeight / this.config.height,
            1,
        );

        gl.uniformMatrix4fv(this.textureMatrixLocation, false, texMatrix);
    }

    public async draw(frame: VideoFrame): Promise<void> {
        const gl = this.context;

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            frame,
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);
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
