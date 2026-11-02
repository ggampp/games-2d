// Fire Walker — compositing and drawing.
//
// Each frame composes the camera's 256×144 window out of the world buffers:
// FX cores > characters (with fire rim light) > near/mid/far layers + ground
// shadows + additive fire. Health bars are drawn as pixel art into the same frame.

'use strict';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false });
const off = document.createElement('canvas');
off.width = VIEW_W;
off.height = H;
const offCtx = off.getContext('2d', { alpha: false });
const image = offCtx.createImageData(VIEW_W, H);
const frame32 = new Uint32Array(image.data.buffer);

const FAR = makeFar();
const MID = makeMid();
const NEAR = makeNear();

function mix(c, r, g, b, k) {
  const cr = c & 255;
  const cg = (c >> 8) & 255;
  const cb = (c >> 16) & 255;
  return ((0xff << 24) | (Math.round(cb + (b - cb) * k) << 16) | (Math.round(cg + (g - cg) * k) << 8) | Math.round(cr + (r - cr) * k)) >>> 0;
}

// Contact shadows and the ash left by burnt enemies.
const ASH = hexRgb('#6a6168');
function groundFx(bg, x, y, shadows) {
  if (y >= GROUND) {
    for (const s of shadows) {
      if (s.k <= 0) continue;
      const u = (x - s.x) / s.rx;
      const v = (y - GROUND - 0.3) / 2.2;
      if (u * u + v * v <= 1) bg = mix(bg, 0, 0, 0, s.k);
    }
  }
  for (const a of scorches) {
    const fade = 1 - a.t / 9;
    const dx = x - a.x;
    if (y >= GROUND) {
      const u = dx / (a.r + 4);
      const v = (y - GROUND - 0.5) / 2.5;
      if (u * u + v * v <= 1) bg = mix(bg, 8, 6, 8, 0.6 * fade);
    } else if (Math.abs(dx) <= 4 - Math.abs(Math.round(dx * 0.4))) {
      bg = mix(bg, ASH[0], ASH[1], ASH[2], 0.85 * fade); // little ash mound
    }
  }
  return bg;
}

function compose(visLeft = 0, visRight = VIEW_W) {
  const pal = PALETTES[cfg.palette];
  const fxPal = PAL32[cfg.palette];
  // Ground shadows: the hero's shrinks as he rises.
  const visible = dissolve.state === 'none' || dissolve.state === 'in' ? 1 : dissolve.state === 'out' ? 1 - dissolve.t / DIS_OUT : 0;
  const rise = clamp((FEET_Y - ch.y) / 40, 0, 1);
  const shadows = [{ x: Math.round(ch.x), rx: 11 * (1 - rise * 0.6), k: 0.55 * visible * (1 - rise * 0.5) }];
  for (const e of enemies) {
    if (e.cut !== null && e.cut > 0.85) continue;
    if (e.def.fly) {
      const h = clamp((FEET_Y - e.y) / 80, 0, 1);
      shadows.push({ x: Math.round(e.x), rx: 7 * (1 - h * 0.5), k: 0.35 * (1 - h * 0.6) });
    } else shadows.push({ x: Math.round(e.x), rx: (6 + e.def.halfW) * e.scale, k: 0.5 });
  }

  if (lineup.on) for (const sh of lineup.shadows) shadows.push(sh);
  const ox = cam.ix;
  const farOff = Math.floor(cam.x * FAR_P);
  const midOff = Math.floor(cam.x * MID_P);
  const isOutline = (j) => mask[j] === 2;
  for (let y = 0; y < H; y++) {
    for (let vx = 0; vx < VIEW_W; vx++) {
      const x = vx + ox;
      const i = y * W + x;
      const fi = y * VIEW_W + vx;
      if (fxE[i]) { frame32[fi] = HOSTILE32[fxE[i]]; continue; }
      if (fx[i]) { frame32[fi] = fxPal[fx[i]]; continue; }
      const m = mask[i];
      if (m) {
        let c = col[i];
        // Rim light: body pixels next to burning outline pick up the fire color.
        if (m === 1) {
          let h = 0;
          if (isOutline(i - 1) && fire[i - 1] > h) h = fire[i - 1];
          if (isOutline(i + 1) && fire[i + 1] > h) h = fire[i + 1];
          if (isOutline(i - W) && fire[i - W] > h) h = fire[i - W];
          if (isOutline(i + W) && fire[i + W] > h) h = fire[i + W];
          // A mid-palette tone (orange, not white) warms the edge without washing it out.
          if (h > 12 && c !== GLOW32) {
            const k = Math.min(h, 24);
            c = mix(c, pal[k * 3], pal[k * 3 + 1], pal[k * 3 + 2], (h / MAX_HEAT) * 0.35);
          }
        }
        frame32[fi] = c;
        continue;
      }
      let bg = NEAR[i] || MID[y * MID_W + vx + midOff] || FAR[y * FAR_W + vx + farOff];
      if (y >= GROUND - 1 && y <= GROUND + 2) bg = groundFx(bg, x, y, shadows);
      const v = fire[i];
      if (!v) { frame32[fi] = bg; continue; }
      // Additive glow over the background.
      const r = Math.min(255, (bg & 255) + pal[v * 3]);
      const g = Math.min(255, ((bg >> 8) & 255) + pal[v * 3 + 1]);
      const b = Math.min(255, ((bg >> 16) & 255) + pal[v * 3 + 2]);
      frame32[fi] = ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
  }
  if (lineup.on) drawLineupMarks(visLeft);
  else {
    drawBars(visLeft, visRight);
    drawHud(visLeft);
    drawBanner(visLeft, visRight);
  }
  if (cfg.skeleton) drawSkeletonPx();
  offCtx.putImageData(image, 0, 0);
}

// ---------------------------------------------------------------------------
// Health bars (pixel art, in the frame)
// ---------------------------------------------------------------------------
const BAR = Object.fromEntries(Object.entries({
  frame: '#0b080d', back: '#2a1218', ghost: '#f2d27a', hero: '#d8432b', heroHi: '#f07a52',
  low: '#ff6a3d', boss: '#8f1f3c', bossHi: '#d8456a', foe: '#b8322a', foeHi: '#e0553f', burn: '#f39c12', heart: '#e2453a', heartHi: '#ff9a8a',
}).map(([k, v]) => [k, pack(hexRgb(v))]));

function px(x, y, c) {
  if (x >= 0 && x < VIEW_W && y >= 0 && y < H) frame32[y * VIEW_W + x] = c;
}

// Framed bar: dark frame, dark back, a light "ghost" for recent damage, then the fill.
function bar(x, y, w, h, frac, ghost, fill, hi) {
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) px(x + i, y + j, BAR.frame);
  const fw = Math.round(clamp(frac, 0, 1) * w);
  const gw = Math.round(clamp(ghost, 0, 1) * w);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let c = BAR.back;
      if (i < gw) c = BAR.ghost;
      if (i < fw) c = j === 0 && h > 2 ? hi : fill;
      px(x + i, y + j, c);
    }
  }
}

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];

// visRight: the rightmost frame column actually on screen (narrow screens crop the view).
function drawBars(visLeft, visRight) {
  for (const e of enemies) {
    if (e.def.boss || e.state === 'dying' || e.barT <= 0 || !e.pose) continue;
    if (e.barT < 0.5 && Math.floor(simTime * 16) % 2) continue; // blink out
    const w = clamp(Math.round(10 + e.maxHp / 30), 10, 22);
    const x = Math.round(e.x - cam.ix - w / 2);
    const y = Math.round(e.pose.top) - 5;
    const burning = e.burn > 0 && Math.floor(simTime * 12) % 2;
    bar(x, y, w, 2, e.hp / e.maxHp, e.hpGhost / e.maxHp, burning ? BAR.burn : BAR.foe, BAR.foeHi);
  }
  // Hero: heart + bar in the top-right corner.
  const hx = visRight - 58;
  const hy = 6;
  const frac = ch.hp / ch.maxHp;
  const danger = frac < 0.3 && Math.floor(simTime * 5) % 2;
  HEART.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') px(hx - 10 + i, hy - 1 + j, danger || (j === 1 && i < 3) ? BAR.heartHi : BAR.heart);
  });
  bar(hx, hy, 52, 4, frac, ch.hpGhost / ch.maxHp, danger ? BAR.low : BAR.hero, BAR.heroHi);
  drawBossBar(visLeft, visRight);
}

// The boss gets a wide bar and his name along the bottom of the screen.
function drawBossBar(visLeft, visRight) {
  const e = BOSS.active;
  if (!e || e.state === 'dying') return;
  const w = Math.min(VIEW_W - 40, visRight - visLeft - 24);
  const x = Math.round((visLeft + visRight - w) / 2);
  const y = H - 7;
  const rage = bossRage(e);
  const fill = rage && Math.floor(simTime * 8) % 2 ? BAR.burn : BAR.boss;
  bar(x, y, w, 3, e.hp / e.maxHp, e.hpGhost / e.maxHp, fill, BAR.bossHi);
  const name = BOSS.name;
  pixelText(name, Math.round((visLeft + visRight - textWidth(name, FONT3)) / 2), y - 8);
}

// ---------------------------------------------------------------------------
// Draw to the screen canvas
// ---------------------------------------------------------------------------
// Pixel-art rules: the 256×144 frame is only ever scaled by a whole number with
// nearest-neighbor, the rest of the screen is black bars, and every offset (bars,
// the phone's follow camera, screen shake) is a whole number of frame pixels.
let view = { s: 1, ox: 0, oy: 0 };
let follow = null; // narrow screens: left edge of the visible part, in frame pixels

function draw() {
  const cw = canvas.width;
  const chh = canvas.height;
  // Largest whole scale that fits; never below 1 (a tiny canvas crops instead).
  let s = Math.max(1, Math.floor(Math.min(cw / VIEW_W, chh / H)));
  // Narrow (portrait) screens: a bigger whole scale that shows at least ~55% of the
  // width and follows the hero, instead of a thin strip.
  const zoom = Math.max(1, Math.floor(Math.min(chh / H, cw / (VIEW_W * 0.55))));
  if (zoom > s && !lineup.on) s = zoom;
  const dw = VIEW_W * s;
  const dh = H * s;
  let ox;
  let visLeft = 0;
  if (dw <= cw) {
    ox = Math.floor((cw - dw) / 2);
    follow = null;
  } else {
    const visW = cw / s;
    const target = clamp(ch.x - cam.ix - visW / 2, 0, VIEW_W - visW);
    follow = follow === null ? target : lerp(follow, target, 0.08);
    visLeft = Math.round(follow); // the crop moves in whole frame pixels
    ox = -visLeft * s;
  }
  const oy = dh <= chh ? Math.floor((chh - dh) / 2) : chh - dh;
  compose(visLeft, Math.min(VIEW_W, Math.floor((cw - ox) / s)));
  // Shake in whole frame pixels.
  const k = shake * 0.7;
  const sx = Math.round((Math.random() - 0.5) * k);
  const sy = Math.round((Math.random() - 0.5) * k);
  view = { s, ox: ox + sx * s, oy: oy + sy * s };
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, chh);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, view.ox, view.oy, dw, dh);
}

// The canvas backing store matches the device pixels exactly, so the browser never
// resamples the image (that would make some pixels one device pixel wider).
function fitCanvas(entry) {
  const dpr = window.devicePixelRatio || 1;
  const box = entry && entry.devicePixelContentBoxSize && entry.devicePixelContentBoxSize[0];
  // Exact device pixels when the browser reports them (and they agree with the ratio).
  if (box && Math.abs(box.inlineSize - entry.contentRect.width * dpr) < 1.5) {
    canvas.width = Math.max(1, box.inlineSize);
    canvas.height = Math.max(1, box.blockSize);
    return;
  }
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
}
