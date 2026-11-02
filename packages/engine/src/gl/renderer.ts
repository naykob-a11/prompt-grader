import type { Params } from '../schema';
import { DEFAULT_PARAMS } from '../schema';
import type { GradeContext, RawImage, Renderer } from '../types';
import detailFrag from './shaders/detail.frag?raw';
import fullscreenVert from './shaders/fullscreen.vert?raw';
import gradeFrag from './shaders/grade.frag?raw';
import type { Tile } from '../tiles';
import {
  paramLocations,
  setParamUniforms,
  withParamUniforms,
  type ParamLocations,
} from './uniforms';

interface Pass {
  program: WebGLProgram;
  params: ParamLocations;
  uniform(name: string): WebGLUniformLocation | null;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function createPass(gl: WebGL2RenderingContext, fragment: string): Pass {
  const program = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, fullscreenVert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, withParamUniforms(fragment));
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`shader link failed: ${gl.getProgramInfoLog(program)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    params: paramLocations(gl, program),
    uniform(name) {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
      return uniforms.get(name)!;
    },
  };
}

function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // NEAREST: linear filtering would blur the image before the 3x3 kernel reads it.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

/** An RGBA8 texture that can be drawn into, resized on demand. */
class Target {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  private width = 0;
  private height = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.texture = createTexture(gl);
    this.framebuffer = gl.createFramebuffer();
  }

  bind(width: number, height: number): void {
    const gl = this.gl;
    if (width !== this.width || height !== this.height) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.width = width;
      this.height = height;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.viewport(0, 0, width, height);
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteFramebuffer(this.framebuffer);
  }
}

export class GradeRenderer implements Renderer {
  readonly backend = 'webgl2';

  private readonly vao: WebGLVertexArrayObject;
  private readonly detailPass: Pass;
  private readonly gradePass: Pass;
  private readonly source: WebGLTexture;
  private readonly detailTarget: Target;
  private readonly outputTarget: Target;
  private readonly onLost: (event: Event) => void;
  private image: RawImage | null = null;
  private ctx: GradeContext | null = null;
  private params: Params = DEFAULT_PARAMS;
  private frame = 0;
  /** Set for a renderer that owns its canvas, whose context nothing will reuse. */
  releaseContext = false;

  /** Returns null when the browser has no WebGL2, so the caller can fall back to the CPU. */
  static create(canvas: HTMLCanvasElement, onContextLost?: () => void): GradeRenderer | null {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
    });
    return gl ? new GradeRenderer(canvas, gl, onContextLost) : null;
  }

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    onContextLost?: () => void,
  ) {
    this.onLost = (event) => {
      event.preventDefault();
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      onContextLost?.();
    };
    canvas.addEventListener('webglcontextlost', this.onLost);

    // The engine works in gamma space on raw values: nothing may convert them on upload.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.disable(gl.DITHER);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.detailPass = createPass(gl, detailFrag);
    this.gradePass = createPass(gl, gradeFrag);
    this.source = createTexture(gl);
    this.detailTarget = new Target(gl);
    this.outputTarget = new Target(gl);
  }

  setImage(image: RawImage, ctx: GradeContext): void {
    this.image = image;
    this.ctx = ctx;
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.upload(image.data, image.width, image.height);
    this.schedule();
  }

  setParams(params: Params): void {
    this.params = params;
    this.schedule();
  }

  render(): Promise<void> {
    this.renderNow();
    return Promise.resolve();
  }

  /** Draws to the canvas now. Read the canvas in the same task, or the buffer may be cleared. */
  renderNow(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    const { gl, image, ctx } = this;
    if (!image || !ctx || gl.isContextLost()) return;
    const tile = wholeImage(image);
    const src = this.runDetail(tile, this.params);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, image.width, image.height);
    this.runGrade(src, tile, this.params, ctx, image.height);
  }

  /** Grades the current image into memory, top row first. */
  readPixels(): Uint8ClampedArray {
    const { image, ctx } = this;
    if (!image || !ctx) throw new Error('no image set');
    const tile = wholeImage(image);
    return this.gradeToMemory(tile, this.params, ctx);
  }

  /**
   * Grades one tile, given the pixels of its padded region. Spatial stages use the full-image
   * size in `ctx`, so the seams match a single pass. Replaces the uploaded image: call setImage
   * again before drawing to the canvas.
   */
  gradeTile(
    region: Uint8ClampedArray,
    tile: Tile,
    params: Params,
    ctx: GradeContext,
  ): Uint8ClampedArray {
    this.upload(region, tile.srcWidth, tile.srcHeight);
    return this.gradeToMemory(tile, params, ctx);
  }

  get maxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
  }

  get contextLost(): boolean {
    return this.gl.isContextLost();
  }

  /** Waits for the GPU to finish everything queued so far. */
  finish(): void {
    this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  dispose(): void {
    const { gl } = this;
    cancelAnimationFrame(this.frame);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.detailTarget.dispose();
    this.outputTarget.dispose();
    gl.deleteTexture(this.source);
    gl.deleteProgram(this.detailPass.program);
    gl.deleteProgram(this.gradePass.program);
    gl.deleteVertexArray(this.vao);
    // Browsers limit live WebGL contexts, so give this one back instead of waiting for GC.
    if (this.releaseContext) gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  private schedule(): void {
    if (this.frame === 0) this.frame = requestAnimationFrame(() => this.renderNow());
  }

  private upload(data: Uint8ClampedArray, width: number, height: number): void {
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.source);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  private gradeToMemory(tile: Tile, params: Params, ctx: GradeContext): Uint8ClampedArray {
    const { gl } = this;
    const src = this.runDetail(tile, params);
    this.outputTarget.bind(tile.width, tile.height);
    this.runGrade(src, tile, params, ctx, 0);
    const out = new Uint8ClampedArray(tile.width * tile.height * 4);
    gl.readPixels(0, 0, tile.width, tile.height, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }

  /** Returns the texture the grade pass should read as its source. */
  private runDetail(tile: Tile, params: Params): WebGLTexture {
    if (params.sharpen <= 0 && params.denoise <= 0) return this.source;
    const { gl, detailPass: pass } = this;
    this.detailTarget.bind(tile.srcWidth, tile.srcHeight);
    gl.useProgram(pass.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.source);
    gl.uniform1i(pass.uniform('u_image'), 0);
    setParamUniforms(gl, pass.params, params);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.detailTarget.texture;
  }

  private runGrade(
    src: WebGLTexture,
    tile: Tile,
    params: Params,
    ctx: GradeContext,
    flipHeight: number,
  ): void {
    const { gl, gradePass: pass } = this;
    gl.useProgram(pass.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.source);
    gl.uniform1i(pass.uniform('u_src'), 0);
    gl.uniform1i(pass.uniform('u_orig'), 1);
    gl.uniform3fv(pass.uniform('u_wbGains'), ctx.wbGains);
    gl.uniform2i(pass.uniform('u_fullSize'), ctx.fullWidth, ctx.fullHeight);
    gl.uniform2i(pass.uniform('u_origin'), tile.x, tile.y);
    gl.uniform2i(pass.uniform('u_pad'), tile.x - tile.srcX, tile.y - tile.srcY);
    gl.uniform1i(pass.uniform('u_flipHeight'), flipHeight);
    setParamUniforms(gl, pass.params, params);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

function wholeImage(image: RawImage): Tile {
  const { width, height } = image;
  return { x: 0, y: 0, width, height, srcX: 0, srcY: 0, srcWidth: width, srcHeight: height };
}
