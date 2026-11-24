import { BLUR_FRAG, COPY_FRAG, MAIN_FRAG, VERT } from './shaders';
import { LUT_SIZE } from './curves';
import type { RenderParams } from './pipeline';

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

type Program = { prog: WebGLProgram; loc: Record<string, WebGLUniformLocation | null> };

export const MAX_SOURCE = 4096;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private gl!: WebGL2RenderingContext;
  private main!: Program;
  private copy!: Program;
  private blur!: Program;
  private vao!: WebGLVertexArrayObject;
  private src: WebGLTexture | null = null;
  private lut: WebGLTexture | null = null;
  private blurL: Target | null = null;
  private blurS: Target | null = null;
  private scratch: Target | null = null;
  private lastLut: Float32Array | null = null;
  private image: (TexImageSource & { width: number; height: number }) | null = null;
  srcWidth = 0;
  srcHeight = 0;
  onRestored?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.init();
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => {
      this.init();
      if (this.image) this.setImage(this.image);
      this.onRestored?.();
    });
  }

  private init() {
    const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not supported on this device/browser.');
    this.gl = gl;
    this.main = this.program(MAIN_FRAG);
    this.copy = this.program(COPY_FRAG);
    this.blur = this.program(BLUR_FRAG);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const p of [this.main, this.copy, this.blur]) {
      const loc = gl.getAttribLocation(p.prog, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    this.vao = vao;
    this.lut = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.lut);
    this.texParams(gl.LINEAR, gl.LINEAR);
    this.lastLut = null;
    this.src = null;
    this.blurL = this.blurS = this.scratch = null;
  }

  get maxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
  }

  private program(frag: string): Program {
    const gl = this.gl;
    const compile = (type: number, srcText: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, srcText);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader error: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Link error: ' + gl.getProgramInfoLog(prog));
    const loc: Record<string, WebGLUniformLocation | null> = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i)!;
      const name = info.name.replace(/\[0\]$/, '');
      loc[name] = gl.getUniformLocation(prog, info.name);
    }
    return { prog, loc };
  }

  private texParams(min: number, mag: number) {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private target(w: number, h: number, existing: Target | null): Target {
    const gl = this.gl;
    if (existing && existing.w === w && existing.h === h) return existing;
    if (existing) {
      gl.deleteTexture(existing.tex);
      gl.deleteFramebuffer(existing.fbo);
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.texParams(gl.LINEAR, gl.LINEAR);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h };
  }

  private draw(p: Program, target: Target | null, w: number, h: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(p.prog);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Upload an image (already oriented & size-capped) and precompute the blur pyramids. */
  setImage(img: TexImageSource & { width: number; height: number }) {
    const gl = this.gl;
    this.image = img;
    this.srcWidth = img.width;
    this.srcHeight = img.height;
    if (this.src) gl.deleteTexture(this.src);
    this.src = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.texParams(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);

    const fit = (long: number): [number, number] => {
      const s = Math.min(1, long / Math.max(img.width, img.height));
      return [Math.max(4, Math.round(img.width * s)), Math.max(4, Math.round(img.height * s))];
    };
    // narrow blur (~fine texture scale), wide blur (~local regions)
    this.blurS = this.makeBlur(fit(1024), 1.6, this.blurS);
    this.blurL = this.makeBlur(fit(256), 5.5, this.blurL);
  }

  private makeBlur([w, h]: [number, number], sigma: number, existing: Target | null): Target {
    const gl = this.gl;
    const out = this.target(w, h, existing);
    this.scratch = this.target(w, h, this.scratch);
    // downsample
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.useProgram(this.copy.prog);
    gl.uniform1i(this.copy.loc.u_tex, 0);
    this.draw(this.copy, out, w, h);
    // horizontal → scratch, vertical → out
    gl.useProgram(this.blur.prog);
    gl.uniform1i(this.blur.loc.u_tex, 0);
    gl.uniform1f(this.blur.loc.u_sigma, sigma);
    gl.bindTexture(gl.TEXTURE_2D, out.tex);
    gl.uniform2f(this.blur.loc.u_step, 1 / w, 0);
    this.draw(this.blur, this.scratch, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.scratch.tex);
    gl.uniform2f(this.blur.loc.u_step, 0, 1 / h);
    this.draw(this.blur, out, w, h);
    return out;
  }

  get hasImage() {
    return !!this.src;
  }

  private setLut(lut: Float32Array | null) {
    if (!lut || lut === this.lastLut) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.lut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, LUT_SIZE, 1, 0, gl.RGBA, gl.FLOAT, lut);
    this.lastLut = lut;
  }

  /** Render to the visible canvas (sized w×h) or to an offscreen target. */
  private renderMain(params: RenderParams, target: Target | null, w: number, h: number) {
    const gl = this.gl;
    if (!this.src || !this.blurL || !this.blurS) return;
    this.setLut(params.lut);
    const { loc } = this.main;
    gl.useProgram(this.main.prog);
    const bind = (unit: number, tex: WebGLTexture | null, name: string) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc[name], unit);
    };
    bind(0, this.src, 'u_src');
    bind(1, this.blurL.tex, 'u_blurL');
    bind(2, this.blurS.tex, 'u_blurS');
    bind(3, this.lut, 'u_lut');
    gl.activeTexture(gl.TEXTURE0);

    gl.uniformMatrix3fv(loc.u_M, false, params.matrix);
    const v = params.view;
    gl.uniform4f(loc.u_view, v.x, v.y, v.w, v.h);
    const r = params.imageRect;
    gl.uniform4f(loc.u_imgRect, r.x, r.y, r.w, r.h);
    gl.uniform3fv(loc.u_borderColor, params.borderColor);
    gl.uniform2f(loc.u_outSize, w, h);
    gl.uniform2fv(loc.u_framePx, params.framePx);
    gl.uniform1f(loc.u_cropAspect, params.cropAspect);
    gl.uniform1i(loc.u_bypass, params.bypass ? 1 : 0);
    gl.uniform1i(loc.u_useLut, params.lut ? 1 : 0);
    gl.uniform1i(loc.u_useHsl, params.useHsl ? 1 : 0);
    for (const [name, val] of Object.entries(params.floats)) gl.uniform1f(loc[name], val);
    for (const [name, val] of Object.entries(params.vecs)) {
      if (val.length === 2) gl.uniform2fv(loc[name], val);
      else gl.uniform3fv(loc[name], val);
    }
    gl.uniform1fv(loc.u_hslHue, params.hslHue);
    gl.uniform1fv(loc.u_hslSat, params.hslSat);
    gl.uniform1fv(loc.u_hslLum, params.hslLum);
    this.draw(this.main, target, w, h);
  }

  renderToCanvas(params: RenderParams, w: number, h: number) {
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.renderMain(params, null, w, h);
  }

  /** Render offscreen and return top-down RGBA pixels. */
  renderToPixels(params: RenderParams, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
    const gl = this.gl;
    const t = this.target(w, h, null);
    this.renderMain(params, t, w, h);
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
    // flip rows (GL is bottom-up)
    const out = new Uint8ClampedArray(w * h * 4);
    const row = w * 4;
    for (let y = 0; y < h; y++) out.set(px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    return out;
  }
}
