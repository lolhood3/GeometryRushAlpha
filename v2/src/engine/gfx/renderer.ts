import type { RGB } from './color.ts';
import { BG_FS, BG_VS, RIBBON_FS, RIBBON_VS, SHAPE_FS, SHAPE_VS } from './shaders.ts';

export const Shape = { Box: 0, Circle: 1, Tri: 2, Saw: 3, Blob: 4, Fade: 5, Block: 6, Hex: 7 } as const;

const STRIDE = 48;
const MAX_INSTANCES = 4096;
const MAX_RIBBON_VERTS = 1024;

export interface BackgroundParams {
  time: number;
  pulse: number;
  energy: number;
  /** Ground line in device pixels from the bottom of the canvas. */
  horizon: number;
  /** Horizontal scroll in device pixels. */
  scroll: number;
  quality: number;
  sky0: RGB;
  sky1: RGB;
  acc: RGB;
  acc2: RGB;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return sh;
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

/**
 * Minimal WebGL2 renderer built for this game's look: every primitive is an
 * instanced quad whose fragment shader evaluates a signed-distance shape with
 * fill, inner stroke and additive glow. One buffer upload and one draw call
 * cover an entire frame of gameplay; trails use a small ribbon program and the
 * sky is a single full-screen procedural pass.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  width = 1;
  height = 1;
  /** Device pixels per CSS pixel actually used for the backbuffer. */
  pixelRatio = 1;
  lost = false;
  /** Instances submitted during the last frame (diagnostics). */
  lastInstances = 0;

  private camX = 0;
  private camY = 0;
  private camScale = 1;

  private shapeProg!: WebGLProgram;
  private ribbonProg!: WebGLProgram;
  private bgProg!: WebGLProgram;
  private shapeVao!: WebGLVertexArrayObject;
  private ribbonVao!: WebGLVertexArrayObject;
  private bgVao!: WebGLVertexArrayObject;
  private instanceBuf!: WebGLBuffer;
  private ribbonBuf!: WebGLBuffer;
  private u: Record<string, WebGLUniformLocation | null> = {};

  private readonly data = new ArrayBuffer(MAX_INSTANCES * STRIDE);
  private readonly f32 = new Float32Array(this.data);
  private readonly u32 = new Uint32Array(this.data);
  private count = 0;
  private frameInstances = 0;
  private readonly ribbonData = new Float32Array(MAX_RIBBON_VERTS * 4);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, powerPreference: 'high-performance', desynchronized: true,
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.setup();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.setup(); this.lost = false; });
  }

  private setup(): void {
    const gl = this.gl;
    this.shapeProg = link(gl, SHAPE_VS, SHAPE_FS);
    this.ribbonProg = link(gl, RIBBON_VS, RIBBON_FS);
    this.bgProg = link(gl, BG_VS, BG_FS);
    const loc = (p: WebGLProgram, name: string, key = name) => { this.u[key] = gl.getUniformLocation(p, name); };
    loc(this.shapeProg, 'u_cam', 's_cam'); loc(this.shapeProg, 'u_px', 's_px');
    loc(this.ribbonProg, 'u_cam', 'r_cam'); loc(this.ribbonProg, 'u_color', 'r_color'); loc(this.ribbonProg, 'u_core', 'r_core');
    for (const n of ['u_res', 'u_time', 'u_pulse', 'u_energy', 'u_horizon', 'u_scroll', 'u_quality', 'u_sky0', 'u_sky1', 'u_acc', 'u_acc2']) {
      loc(this.bgProg, n);
    }

    // Shape VAO: static unit quad + one interleaved per-instance buffer.
    this.shapeVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.shapeVao);
    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.instanceBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const attr = (i: number, size: number, type: number, norm: boolean, offset: number) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, size, type, norm, STRIDE, offset);
      gl.vertexAttribDivisor(i, 1);
    };
    attr(1, 2, gl.FLOAT, false, 0);
    attr(2, 2, gl.FLOAT, false, 8);
    attr(3, 2, gl.FLOAT, false, 16);
    attr(4, 2, gl.FLOAT, false, 24);
    attr(5, 2, gl.FLOAT, false, 32);
    attr(6, 4, gl.UNSIGNED_BYTE, true, 40);
    attr(7, 4, gl.UNSIGNED_BYTE, true, 44);

    this.ribbonVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.ribbonVao);
    this.ribbonBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ribbonBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.ribbonData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    this.bgVao = gl.createVertexArray()!;
    gl.bindVertexArray(null);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** Resizes the backbuffer. Returns true when the size actually changed. */
  resize(cssW: number, cssH: number, pixelRatio: number): boolean {
    const w = Math.max(1, Math.round(cssW * pixelRatio));
    const h = Math.max(1, Math.round(cssH * pixelRatio));
    this.pixelRatio = pixelRatio;
    if (w === this.width && h === this.height) return false;
    this.width = this.canvas.width = w;
    this.height = this.canvas.height = h;
    return true;
  }

  begin(): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.width, this.height);
    this.count = 0;
    this.frameInstances = 0;
  }

  /** `cx, cy`: world point at the centre of the screen. `scale`: device px per world unit. */
  setCamera(cx: number, cy: number, scale: number): void {
    this.flush();
    this.camX = cx;
    this.camY = cy;
    this.camScale = scale;
  }

  background(p: BackgroundParams): void {
    const gl = this.gl;
    const u = this.u;
    gl.useProgram(this.bgProg);
    gl.bindVertexArray(this.bgVao);
    gl.disable(gl.BLEND);
    gl.uniform2f(u.u_res, this.width, this.height);
    gl.uniform1f(u.u_time, p.time);
    gl.uniform1f(u.u_pulse, p.pulse);
    gl.uniform1f(u.u_energy, p.energy);
    gl.uniform1f(u.u_horizon, p.horizon);
    gl.uniform1f(u.u_scroll, p.scroll);
    gl.uniform1f(u.u_quality, p.quality);
    gl.uniform3f(u.u_sky0, p.sky0[0], p.sky0[1], p.sky0[2]);
    gl.uniform3f(u.u_sky1, p.sky1[0], p.sky1[1], p.sky1[2]);
    gl.uniform3f(u.u_acc, p.acc[0], p.acc[1], p.acc[2]);
    gl.uniform3f(u.u_acc2, p.acc2[0], p.acc2[1], p.acc2[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
  }

  /**
   * Queues one SDF instance.
   * @param hw,hh   half extents in world units
   * @param fill    packed RGBA8 (see color.pack)
   * @param line    packed RGBA8 used for stroke and glow
   * @param stroke  inner stroke width in world units
   * @param glowR   glow radius in world units
   * @param glowS   glow intensity
   * @param p1      shape parameter (corner radius, tooth count, fade power)
   */
  shape(
    shape: number, x: number, y: number, hw: number, hh: number, rot: number,
    fill: number, line: number, stroke = 0, glowR = 0, glowS = 0, p1 = 0,
  ): void {
    if (this.count === MAX_INSTANCES) this.flush();
    const i = this.count * 12;
    const f = this.f32;
    f[i] = x; f[i + 1] = y; f[i + 2] = hw; f[i + 3] = hh;
    f[i + 4] = rot; f[i + 5] = shape; f[i + 6] = p1; f[i + 7] = stroke;
    f[i + 8] = glowR; f[i + 9] = glowS;
    this.u32[i + 10] = fill;
    this.u32[i + 11] = line;
    this.count++;
  }

  flush(): void {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.useProgram(this.shapeProg);
    gl.bindVertexArray(this.shapeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.f32, 0, this.count * 12);
    gl.uniform4f(this.u.s_cam, this.camX, this.camY, (2 * this.camScale) / this.width, (2 * this.camScale) / this.height);
    gl.uniform1f(this.u.s_px, 1 / this.camScale);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    this.frameInstances += this.count;
    this.count = 0;
  }

  /**
   * Draws a soft additive ribbon through `n` points.
   * `pts` holds (x, y, halfWidth, alpha) per point, oldest first.
   */
  ribbon(pts: Float32Array, n: number, color: RGB, alpha: number, core: number): void {
    if (n < 2) return;
    this.flush();
    const out = this.ribbonData;
    const max = Math.min(n, MAX_RIBBON_VERTS / 2);
    let o = 0;
    for (let i = 0; i < max; i++) {
      const a = Math.max(0, i - 1) * 4;
      const b = Math.min(max - 1, i + 1) * 4;
      let dx = pts[b] - pts[a];
      let dy = pts[b + 1] - pts[a + 1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const x = pts[i * 4], y = pts[i * 4 + 1], w = pts[i * 4 + 2], al = pts[i * 4 + 3];
      out[o++] = x - dy * w; out[o++] = y + dx * w; out[o++] = -1; out[o++] = al;
      out[o++] = x + dy * w; out[o++] = y - dx * w; out[o++] = 1; out[o++] = al;
    }
    const gl = this.gl;
    gl.useProgram(this.ribbonProg);
    gl.bindVertexArray(this.ribbonVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ribbonBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, out, 0, o);
    gl.uniform4f(this.u.r_cam, this.camX, this.camY, (2 * this.camScale) / this.width, (2 * this.camScale) / this.height);
    gl.uniform4f(this.u.r_color, color[0], color[1], color[2], alpha);
    gl.uniform1f(this.u.r_core, core);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, max * 2);
  }

  end(): void {
    this.flush();
    this.lastInstances = this.frameInstances;
  }
}
