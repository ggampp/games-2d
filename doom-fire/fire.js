// DOOM fire (PSX / N64) — reproduction of the algorithm described by Fabien Sanglard.
// The whole effect is a grid of integers 0..36 (indices into a 37-color palette).
// The bottom row is the "source" (36 = white-hot). Every frame, each pixel copies the
// value of the pixel below it, minus a random 0/1 decay, shifted sideways by a random
// amount (the "wind"). That's it: no shaders, no particles, no physics.

'use strict';

// 37 colors: black -> dark red -> orange -> yellow -> white.
const PALETTE_RGB = [
  0x07, 0x07, 0x07, 0x1f, 0x07, 0x07, 0x2f, 0x0f, 0x07, 0x47, 0x0f, 0x07,
  0x57, 0x17, 0x07, 0x67, 0x1f, 0x07, 0x77, 0x1f, 0x07, 0x8f, 0x27, 0x07,
  0x9f, 0x2f, 0x07, 0xaf, 0x3f, 0x07, 0xbf, 0x47, 0x07, 0xc7, 0x47, 0x07,
  0xdf, 0x4f, 0x07, 0xdf, 0x57, 0x07, 0xdf, 0x57, 0x07, 0xd7, 0x5f, 0x07,
  0xd7, 0x5f, 0x07, 0xd7, 0x67, 0x0f, 0xcf, 0x6f, 0x0f, 0xcf, 0x77, 0x0f,
  0xcf, 0x7f, 0x0f, 0xcf, 0x87, 0x17, 0xc7, 0x87, 0x17, 0xc7, 0x8f, 0x17,
  0xc7, 0x97, 0x1f, 0xbf, 0x9f, 0x1f, 0xbf, 0x9f, 0x1f, 0xbf, 0xa7, 0x27,
  0xbf, 0xa7, 0x27, 0xbf, 0xaf, 0x2f, 0xb7, 0xaf, 0x2f, 0xb7, 0xb7, 0x2f,
  0xb7, 0xb7, 0x37, 0xcf, 0xcf, 0x6f, 0xdf, 0xdf, 0x9f, 0xef, 0xef, 0xc7,
  0xff, 0xff, 0xff,
];
const MAX = PALETTE_RGB.length / 3 - 1; // 36

// Palette packed as little-endian ABGR uint32 for direct writes into ImageData.
const PALETTE32 = new Uint32Array(MAX + 1);
for (let i = 0; i <= MAX; i++) {
  const r = PALETTE_RGB[i * 3], g = PALETTE_RGB[i * 3 + 1], b = PALETTE_RGB[i * 3 + 2];
  PALETTE32[i] = (0xff << 24) | (b << 16) | (g << 8) | r;
}
const paletteCss = (i) =>
  `rgb(${PALETTE_RGB[i * 3]},${PALETTE_RGB[i * 3 + 1]},${PALETTE_RGB[i * 3 + 2]})`;

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
class DoomFire {
  constructor(width, height) {
    this.resize(width, height);
    this.wind = 1;     // 0 = straight up, 1 = classic DOOM drift, 2+ = strong wind
    this.decay = 1;    // max intensity lost per row (classic = 1)
    this.windDir = -1; // -1 = flames lean left (as in DOOM), +1 = right
  }

  resize(width, height) {
    this.w = width;
    this.h = height;
    this.pixels = new Uint8Array(width * height);
    this.setSource(MAX);
  }

  setSource(value) {
    const { w, h, pixels } = this;
    pixels.fill(value, (h - 1) * w, h * w);
  }

  // Gradually fade the source in or out (like the DOOM title screen).
  stepSource(target) {
    const { w, h, pixels } = this;
    for (let x = 0; x < w; x++) {
      const i = (h - 1) * w + x;
      const v = pixels[i];
      if (v < target) pixels[i] = Math.min(target, v + ((Math.random() * 3) | 0));
      else if (v > target) pixels[i] = Math.max(target, v - ((Math.random() * 3) | 0));
    }
  }

  // The core of the effect — the "few lines of code".
  spread(src) {
    const { w, pixels } = this;
    const pixel = pixels[src];
    if (pixel === 0) {
      pixels[src - w] = 0;
      return;
    }
    const rand = (Math.random() * 4) | 0;                       // 0..3
    const shift = this.wind === 0 ? 0 : Math.round(((rand - 1) * this.wind)) * -this.windDir;
    let dst = src - w - shift;
    // Wrap horizontally inside the destination row (avoids writing past the array).
    const row = ((src / w) | 0) - 1;
    const rowStart = row * w;
    if (dst < rowStart) dst += w;
    else if (dst >= rowStart + w) dst -= w;
    const loss = this.decay === 0 ? 0 : (rand & 1) * this.decay;
    pixels[dst] = pixel > loss ? pixel - loss : 0;
  }

  update() {
    const { w, h } = this;
    for (let x = 0; x < w; x++) {
      for (let y = 1; y < h; y++) {
        this.spread(y * w + x);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const canvas = document.getElementById('fire');
const ctx = canvas.getContext('2d', { alpha: false });
const off = document.createElement('canvas');
const offCtx = off.getContext('2d', { alpha: false });
let image, image32;

const ui = {
  mode: document.getElementById('mode'),
  res: document.getElementById('res'),
  wind: document.getElementById('wind'),
  windDir: document.getElementById('windDir'),
  decay: document.getElementById('decay'),
  fps: document.getElementById('fps'),
  toggle: document.getElementById('toggle'),
  pause: document.getElementById('pause'),
  step: document.getElementById('step'),
  windVal: document.getElementById('windVal'),
  decayVal: document.getElementById('decayVal'),
  fpsVal: document.getElementById('fpsVal'),
  palette: document.getElementById('palette'),
};

const RESOLUTIONS = {
  low: [80, 50],
  psx: [320, 168],   // the PSX/N64 title screen buffer
  high: [640, 336],
};
const DEBUG_SIZE = [26, 18]; // small grid so every number is readable
const DEBUG_DECAY = 3;       // short grid -> faster cooling so the whole 36..0 range is visible

const state = {
  debug: false,
  running: true,
  burning: true,
  sourceTarget: MAX,
  fps: 27, // DOOM's original 35Hz tic-based look feels right around 25-35
};

const fire = new DoomFire(...RESOLUTIONS.psx);

function allocBuffers() {
  off.width = fire.w;
  off.height = fire.h;
  image = offCtx.createImageData(fire.w, fire.h);
  image32 = new Uint32Array(image.data.buffer);
}

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
}

function drawPixels() {
  const { pixels } = fire;
  for (let i = 0; i < pixels.length; i++) image32[i] = PALETTE32[pixels[i]];
  offCtx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#070707';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // "Cover" scaling: fill the canvas, crop the sides on tall screens, anchor to the bottom.
  const scale = Math.max(canvas.width / fire.w, canvas.height / fire.h);
  const dw = fire.w * scale, dh = fire.h * scale;
  ctx.drawImage(off, (canvas.width - dw) / 2, canvas.height - dh, dw, dh);
}

function drawDebug() {
  const { w, h, pixels } = fire;
  const cw = canvas.width / w;
  const ch = canvas.height / h;
  ctx.fillStyle = '#070707';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const fontPx = Math.floor(Math.min(cw * 0.42, ch * 0.5));
  ctx.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = pixels[y * w + x];
      const px = x * cw, py = y * ch;
      ctx.fillStyle = paletteCss(v);
      ctx.fillRect(px, py, cw - 1, ch - 1);
      ctx.fillStyle = v > 26 ? '#111' : v === 0 ? '#3a3a3a' : '#f3f3f3';
      ctx.fillText(String(v), px + cw / 2, py + ch / 2 + 1);
    }
  }
}

function render() {
  if (state.debug) drawDebug();
  else drawPixels();
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let last = 0;
let acc = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(250, t - last);
  last = t;
  if (!state.running) return;
  const stepMs = 1000 / (state.debug ? Math.min(state.fps, 8) : state.fps);
  acc += dt;
  if (acc < stepMs) return;
  acc %= stepMs;
  tick();
}

function tick() {
  fire.stepSource(state.sourceTarget);
  fire.update();
  render();
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
function applyResolution() {
  const [w, h] = state.debug ? DEBUG_SIZE : RESOLUTIONS[ui.res.value];
  fire.resize(w, h);
  fire.setSource(state.burning ? MAX : 0);
  allocBuffers();
  render();
}

function setLabels() {
  ui.windVal.textContent = fire.wind;
  ui.decayVal.textContent = fire.decay;
  ui.fpsVal.textContent = state.fps;
  ui.toggle.textContent = state.burning ? 'Apagar fogo' : 'Acender fogo';
  ui.pause.textContent = state.running ? 'Pausar' : 'Continuar';
  ui.step.disabled = state.running;
}

let savedDecay = fire.decay;
ui.mode.addEventListener('change', () => {
  const debug = ui.mode.value === 'numbers';
  if (debug === state.debug) return;
  state.debug = debug;
  if (debug) { savedDecay = fire.decay; fire.decay = DEBUG_DECAY; }
  else fire.decay = savedDecay;
  ui.decay.value = fire.decay;
  setLabels();
  ui.res.disabled = state.debug;
  document.body.classList.toggle('debug', state.debug);
  applyResolution();
});
ui.res.addEventListener('change', applyResolution);
ui.wind.addEventListener('input', () => { fire.wind = +ui.wind.value; setLabels(); });
ui.windDir.addEventListener('change', () => { fire.windDir = +ui.windDir.value; });
ui.decay.addEventListener('input', () => { fire.decay = +ui.decay.value; setLabels(); });
ui.fps.addEventListener('input', () => { state.fps = +ui.fps.value; setLabels(); });
ui.toggle.addEventListener('click', () => {
  state.burning = !state.burning;
  state.sourceTarget = state.burning ? MAX : 0;
  setLabels();
});
ui.pause.addEventListener('click', () => { state.running = !state.running; setLabels(); });
ui.step.addEventListener('click', tick);

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.code === 'Space') { e.preventDefault(); ui.toggle.click(); }
  else if (e.key === 'p') ui.pause.click();
  else if (e.key === 'n' && !state.running) tick();
  else if (e.key === 'd') {
    ui.mode.value = state.debug ? 'pixels' : 'numbers';
    ui.mode.dispatchEvent(new Event('change'));
  }
});

// Click / drag on the canvas paints a heat source at that column of the bottom row.
function heatAt(clientX) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((clientX - rect.left) / rect.width) * fire.w);
  const r = Math.max(1, Math.round(fire.w / 24));
  const base = (fire.h - 1) * fire.w;
  for (let i = Math.max(0, x - r); i <= Math.min(fire.w - 1, x + r); i++) fire.pixels[base + i] = MAX;
}
let painting = false;
canvas.addEventListener('pointerdown', (e) => { painting = true; heatAt(e.clientX); });
canvas.addEventListener('pointermove', (e) => { if (painting) heatAt(e.clientX); });
window.addEventListener('pointerup', () => { painting = false; });

// Palette strip — the "37 numbers".
for (let i = 0; i <= MAX; i++) {
  const s = document.createElement('span');
  s.style.background = paletteCss(i);
  s.title = `${i}: ${paletteCss(i)}`;
  ui.palette.appendChild(s);
}

new ResizeObserver(() => { fitCanvas(); render(); }).observe(canvas);

fitCanvas();
allocBuffers();
setLabels();
requestAnimationFrame((t) => { last = t; frame(t); });
