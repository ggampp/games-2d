/**
 * WebGL2 post-processing: bloom (bright-pass + separable blur at quarter res),
 * chromatic aberration weighted by local brightness, film grain and vignette.
 * Takes a 2D canvas each frame as the scene texture.
 */

const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS_BRIGHT = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D scene;
uniform float threshold;
void main() {
  vec3 c = texture(scene, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float k = smoothstep(threshold, threshold + 0.35, l);
  o = vec4(c * k, 1.0);
}`;

const FS_BLUR = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D src;
uniform vec2 dir;
void main() {
  float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec3 c = texture(src, uv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture(src, uv + dir * float(i)).rgb * w[i];
    c += texture(src, uv - dir * float(i)).rgb * w[i];
  }
  o = vec4(c, 1.0);
}`;

const FS_FINAL = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D scene;
uniform sampler2D bloomA;
uniform sampler2D bloomB;
uniform float time;
uniform vec2 res;
uniform float bloomAmt;
uniform float caAmt;
uniform float grainAmt;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 bl = texture(bloomA, uv).rgb * 0.6 + texture(bloomB, uv).rgb * 0.75;
  float bLum = dot(bl, vec3(0.299, 0.587, 0.114));

  // Chromatic aberration: a small radial base plus extra around bright (beam) areas.
  vec2 d = (uv - 0.5);
  float ca = caAmt * (0.12 + 2.6 * clamp(bLum, 0.0, 1.0));
  vec2 off = d * ca;
  float r = texture(scene, uv + off).r;
  float g = texture(scene, uv).g;
  float b = texture(scene, uv - off).b;
  vec3 c = vec3(r, g, b);

  c += bl * bloomAmt;

  // soft tone roll-off so hot cores don't clip to flat white
  c = c / (1.0 + c * 0.12);

  // film grain (animated)
  float n = hash(floor(uv * res * 0.5) + fract(time * 13.7) * 91.0) - 0.5;
  c += n * grainAmt * (0.6 + 0.8 * length(c));

  // vignette
  float v = smoothstep(1.25, 0.35, length(d) * 1.6);
  c *= 0.9 + 0.1 * v;

  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

interface Pass { prog: WebGLProgram; loc: Record<string, WebGLUniformLocation | null> }

export class PostProcessor {
  private gl: WebGL2RenderingContext;
  private sceneTex: WebGLTexture;
  private fbo: { fb: WebGLFramebuffer; tex: WebGLTexture }[] = [];
  private bright!: Pass;
  private blur!: Pass;
  private final!: Pass;
  private quad!: WebGLVertexArrayObject;
  private w = 0;
  private h = 0;
  private bw = 0;
  private bh = 0;
  public settings = { bloom: 0.8, ca: 0.0035, grain: 0.045 };

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl;
    this.sceneTex = this.makeTex();
    this.bright = this.makePass(FS_BRIGHT, ['scene', 'threshold']);
    this.blur = this.makePass(FS_BLUR, ['src', 'dir']);
    this.final = this.makePass(FS_FINAL, ['scene', 'bloomA', 'bloomB', 'time', 'res', 'bloomAmt', 'caAmt', 'grainAmt']);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.quad = vao;
  }

  private makeTex(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  private makePass(fs: string, uniforms: string[]): Pass {
    const gl = this.gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, this.compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, this.compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(prog, 0, 'p');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
    const loc: Record<string, WebGLUniformLocation | null> = {};
    for (const u of uniforms) loc[u] = gl.getUniformLocation(prog, u);
    return { prog, loc };
  }

  private ensureSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    this.bw = Math.max(1, Math.floor(w / 4));
    this.bh = Math.max(1, Math.floor(h / 4));
    for (const f of this.fbo) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
    this.fbo = [];
    for (let i = 0; i < 3; i++) {
      const tex = this.makeTex();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.bw, this.bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      this.fbo.push({ fb, tex });
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  render(scene: HTMLCanvasElement, time: number) {
    const gl = this.gl;
    this.ensureSize(scene.width, scene.height);
    gl.bindVertexArray(this.quad);
    gl.disable(gl.BLEND);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);

    // 1. bright pass -> fbo0
    gl.viewport(0, 0, this.bw, this.bh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[0].fb);
    gl.useProgram(this.bright.prog);
    gl.uniform1i(this.bright.loc.scene, 0);
    gl.uniform1f(this.bright.loc.threshold, 0.32);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. blur ping-pong: fbo0 -> fbo1 (H) -> fbo2 (V)   [tight bloom]
    gl.useProgram(this.blur.prog);
    gl.uniform1i(this.blur.loc.src, 1);
    gl.activeTexture(gl.TEXTURE1);
    const blurStep = (from: number, to: number, dx: number, dy: number) => {
      gl.bindTexture(gl.TEXTURE_2D, this.fbo[from].tex);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[to].fb);
      gl.uniform2f(this.blur.loc.dir, dx / this.bw, dy / this.bh);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    blurStep(0, 1, 1.5, 0);
    blurStep(1, 2, 0, 1.5);
    // wide bloom: continue blurring 2 -> 1 -> 0 with a larger radius
    blurStep(2, 1, 4, 0);
    blurStep(1, 0, 0, 4);

    // 3. composite to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.final.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fbo[2].tex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.fbo[0].tex);
    gl.uniform1i(this.final.loc.scene, 0);
    gl.uniform1i(this.final.loc.bloomA, 1);
    gl.uniform1i(this.final.loc.bloomB, 2);
    gl.uniform1f(this.final.loc.time, time);
    gl.uniform2f(this.final.loc.res, this.w, this.h);
    gl.uniform1f(this.final.loc.bloomAmt, this.settings.bloom);
    gl.uniform1f(this.final.loc.caAmt, this.settings.ca);
    gl.uniform1f(this.final.loc.grainAmt, this.settings.grain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
