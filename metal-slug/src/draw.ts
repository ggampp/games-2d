import type { FoeKind, WeaponId } from "./const";
import { GROUND, VH, VW } from "./const";

function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
  ctx.fill();
}

function hash(n: number): number {
  let x = n | 0;
  x = (x << 13) ^ x;
  return (x * (x * x * 15731 + 789221) + 1376312589) >>> 0;
}

export function motionBob(anim: "idle" | "run" | "jump", frame: number, time: number): number {
  if (anim === "run") return [0, -2, 0, -3][frame & 3];
  if (anim === "jump") return -4;
  return Math.sin(time * 3) * 0.7;
}

export function gunAngle(aimX: number, aimY: number, facing: number): number {
  const lx = aimX * facing;
  const ly = aimY;
  if (lx < 0.2 && Math.abs(ly) > 0.4) return ly < 0 ? -Math.PI / 2 : Math.PI / 2;
  return Math.atan2(ly, Math.max(0.25, lx));
}

export function muzzlePoint(
  feetX: number,
  feetY: number,
  facing: number,
  aimX: number,
  aimY: number,
  bob: number,
  crouch: boolean,
  recoil: boolean,
): { x: number; y: number } {
  const ang = gunAngle(aimX, aimY, facing);
  const len = recoil ? 28 : 34;
  const sx = 16 - (recoil ? 2 : 0);
  const sy = -34 + bob + (crouch ? 8 : 0);
  const lx = sx + Math.cos(ang) * len;
  const ly = sy + Math.sin(ang) * len;
  return { x: feetX + facing * lx, y: feetY + ly };
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, cam: number, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#16315f");
  sky.addColorStop(0.42, "#e25a28");
  sky.addColorStop(0.72, "#ffb15a");
  sky.addColorStop(1, "#ffe08a");
  ctx.fillStyle = sky;
  ctx.fillRect(-8, -8, VW + 16, VH + 16);

  ctx.fillStyle = "rgba(255, 236, 190, 0.35)";
  ctx.beginPath();
  ctx.arc(338, 74, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff3c8";
  ctx.beginPath();
  ctx.arc(338, 74, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(-cam * 0.18, 0);
  drawCongress(ctx, 80, GROUND - 18);
  drawBlocks(ctx, -40, GROUND - 8);
  drawBlocks(ctx, 340, GROUND - 8);
  ctx.restore();

  ctx.save();
  ctx.translate(-((cam * 0.32 + time * 8) % (VW + 160)), 0);
  drawCloud(ctx, 40, 36);
  drawCloud(ctx, 220, 52);
  drawCloud(ctx, 420, 28);
  drawCloud(ctx, 620, 48);
  ctx.restore();

  for (let i = 0; i < 3; i += 1) {
    const x = ((i * 220 - cam * 0.45 + time * (18 + i * 8)) % (VW + 90)) - 40;
    drawMiniHeli(ctx, x, 48 + i * 10, time + i);
  }

  ctx.save();
  ctx.translate(-cam * 0.55, 0);
  for (let i = 0; i < 18; i += 1) {
    const x = i * 36;
    ctx.fillStyle = i % 2 === 0 ? "#4a241c" : "#3a1c16";
    ctx.fillRect(x, GROUND - 22, 8, 22);
    ctx.fillStyle = "#009c3b";
    ctx.fillRect(x + 8, GROUND - 20, 7, 5);
    ctx.fillStyle = "#ffdf00";
    ctx.fillRect(x + 8, GROUND - 16, 7, 3);
  }
  ctx.restore();
}

function drawCongress(ctx: CanvasRenderingContext2D, x: number, base: number): void {
  ctx.fillStyle = "#4a261c";
  ctx.fillRect(x, base - 26, 200, 26);
  ctx.fillRect(x + 22, base - 118, 24, 100);
  ctx.fillRect(x + 154, base - 118, 24, 100);
  ctx.fillStyle = "#5c3024";
  ctx.fillRect(x + 28, base - 112, 6, 90);
  ctx.fillRect(x + 160, base - 112, 6, 90);
  ctx.fillStyle = "#4a261c";
  ctx.beginPath();
  ctx.arc(x + 100, base - 26, 42, Math.PI, 0, true);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 100, base - 34, 22, Math.PI, 0, true);
  ctx.fill();
}

function drawBlocks(ctx: CanvasRenderingContext2D, x: number, base: number): void {
  ctx.fillStyle = "#3d221c";
  const hs = [34, 52, 28, 64, 40, 22];
  hs.forEach((h, i) => {
    ctx.fillRect(x + i * 22, base - h, 18, h);
  });
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "rgba(255, 236, 214, 0.8)";
  ctx.beginPath();
  ctx.ellipse(x, y, 28, 10, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 18, y + 2, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMiniHeli(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#2a241c";
  ctx.fillRect(-12, -4, 22, 8);
  ctx.fillRect(8, -2, 12, 3);
  ctx.save();
  ctx.rotate(time * 18);
  ctx.fillRect(-16, -1, 32, 2);
  ctx.restore();
  ctx.restore();
}

export function drawGround(ctx: CanvasRenderingContext2D, cam: number): void {
  const x0 = cam - 30;
  const x1 = cam + VW + 30;
  ctx.fillStyle = "#6b4428";
  ctx.fillRect(x0, GROUND, x1 - x0, VH - GROUND + 20);
  ctx.fillStyle = "#8a5a34";
  ctx.fillRect(x0, GROUND + 8, x1 - x0, 6);
  ctx.fillStyle = "#3f7d32";
  ctx.fillRect(x0, GROUND, x1 - x0, 5);
  ctx.fillStyle = "#2f641f";
  for (let x = Math.floor(x0 / 10) * 10; x < x1; x += 10) {
    const n = hash(x);
    if (n % 3 === 0) ctx.fillRect(x, GROUND - 3, 2, 3 + (n % 3));
    if (n % 7 === 0) {
      ctx.fillStyle = "#5a3a22";
      ctx.fillRect(x + 3, GROUND + 14 + (n % 8), 3, 2);
      ctx.fillStyle = "#2f641f";
    }
  }
  ctx.fillStyle = "#e6c04a";
  for (let x = Math.floor(x0 / 28) * 28; x < x1; x += 28) {
    ctx.fillRect(x, GROUND + 20, 12, 2);
  }
}

export function drawPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = "#6a5030";
  ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = "#c2a06a";
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = "#3e3428";
  for (let i = 8; i < w; i += 14) ctx.fillRect(x + i, y + 4, 2, 6);
}

export function drawFlag(ctx: CanvasRenderingContext2D, x: number, time: number): void {
  ctx.fillStyle = "#d8d2c4";
  ctx.fillRect(x, GROUND - 58, 3, 58);
  const wave = Math.sin(time * 4 + x) * 2;
  ctx.fillStyle = "#009c3b";
  ctx.fillRect(x + 3, GROUND - 56 + wave, 16, 10);
  ctx.fillStyle = "#ffdf00";
  ctx.beginPath();
  ctx.moveTo(x + 11, GROUND - 55 + wave);
  ctx.lineTo(x + 17, GROUND - 51 + wave);
  ctx.lineTo(x + 11, GROUND - 47 + wave);
  ctx.lineTo(x + 6, GROUND - 51 + wave);
  ctx.fill();
  ctx.fillStyle = "#002776";
  ctx.beginPath();
  ctx.arc(x + 11, GROUND - 51 + wave, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawCar(ctx: CanvasRenderingContext2D, x: number): void {
  ctx.fillStyle = "#3a241c";
  box(ctx, x, GROUND - 16, 42, 12, 2, "#3a241c");
  ctx.fillStyle = "#241610";
  ctx.beginPath();
  ctx.arc(x + 10, GROUND - 2, 5, 0, Math.PI * 2);
  ctx.arc(x + 32, GROUND - 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6ec8e0";
  ctx.fillRect(x + 8, GROUND - 22, 16, 7);
}

export function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, opened: boolean, time: number): void {
  if (opened) {
    ctx.fillStyle = "#6a4a28";
    ctx.fillRect(x - 12, y - 6, 24, 6);
    ctx.fillRect(x - 4, y - 12, 8, 6);
    return;
  }
  box(ctx, x - 13, y - 24, 26, 24, 2, "#c48a3a");
  ctx.fillStyle = "#8a5a22";
  ctx.fillRect(x - 13, y - 16, 26, 3);
  ctx.fillRect(x - 2, y - 24, 3, 24);
  const blink = Math.sin(time * 6) > 0;
  ctx.fillStyle = blink ? "#fff4c2" : "#ffe08a";
  ctx.font = "700 12px Impact, Arial Black, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("?", x, y - 8);
}

export function drawBarrel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#b42318";
  box(ctx, x - 9, y - 20, 18, 20, 3, "#c43222");
  ctx.fillStyle = "#f0d070";
  ctx.fillRect(x - 9, y - 14, 18, 3);
  ctx.fillRect(x - 9, y - 8, 18, 3);
}

export function drawPickup(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string): void {
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === "heal") {
    ctx.fillStyle = "#f4e2b0";
    ctx.fillRect(x - 2, y - 8, 4, 10);
    ctx.fillStyle = "#e23b3b";
    ctx.beginPath();
    ctx.arc(x + 4, y - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (kind === "nade") {
    ctx.fillStyle = "#3f7d32";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8d2c4";
    ctx.fillRect(x - 1, y - 10, 2, 5);
    return;
  }
  const color = kind === "heavy" ? "#ff9a2a" : kind === "spread" ? "#3dff7a" : "#ffe14a";
  ctx.fillStyle = color;
  box(ctx, x - 7, y - 8, 14, 12, 2, color);
  ctx.fillStyle = "#1a120c";
  ctx.font = "700 8px Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(kind === "heavy" ? "H" : kind === "spread" ? "L" : "R", x, y + 2);
}

export function drawBullet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: WeaponId | "foe",
): void {
  if (style === "foe") {
    ctx.fillStyle = "#ffd0d0";
    ctx.fillRect(x - 4, y - 2, 8, 4);
    ctx.fillStyle = "#ff3030";
    ctx.fillRect(x - 2, y - 1, 4, 2);
    return;
  }
  if (style === "heavy") {
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff6a1a";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = "#f4e2ff";
  ctx.fillRect(x - 6, y - 2, 12, 4);
  ctx.fillStyle = "#c060ff";
  ctx.fillRect(x - 3, y - 1, 5, 2);
}

export function drawNade(ctx: CanvasRenderingContext2D, x: number, y: number, enemy: boolean): void {
  ctx.fillStyle = enemy ? "#e23b3b" : "#3f7d32";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eee";
  ctx.fillRect(x - 1, y - 7, 2, 4);
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  anim: "idle" | "run" | "jump",
  frame: number,
  aimX: number,
  aimY: number,
  biting: boolean,
  crouch: boolean,
  recoil: boolean,
  time: number,
): void {
  const bob = motionBob(anim, frame, time) + (crouch ? 8 : 0);
  const phase = anim === "jump" ? 1 : frame & 3;
  ctx.save();
  ctx.translate(0, bob);

  ctx.fillStyle = "#4a3018";
  ctx.beginPath();
  ctx.moveTo(-8, -26);
  ctx.quadraticCurveTo(-40, -30, -52, -16);
  ctx.quadraticCurveTo(-36, -12, -10, -16);
  ctx.fill();

  leg(ctx, -8, (phase + 2) & 3, anim === "jump");
  box(ctx, -26, -48, 48, 28, 8, "#a67c49");
  box(ctx, -16, -38, 30, 14, 5, "#efd2a4");
  ctx.fillStyle = "#5a3b22";
  ctx.fillRect(-14, -46, 6, 4);
  ctx.fillRect(-2, -44, 5, 4);
  ctx.fillRect(8, -42, 6, 3);
  leg(ctx, 8, phase, anim === "jump");

  const lunge = biting ? 8 : 0;
  box(ctx, 12 + lunge, -56, 16, 18, 4, "#a67c49");
  box(ctx, 22 + lunge, -70, 32, 22, 5, "#b88955");
  const jaw = biting ? 8 : 3;
  ctx.fillStyle = "#7a2430";
  ctx.fillRect(36 + lunge, -52, 16, 4 + jaw * 0.3);
  box(ctx, 34 + lunge, -50 + jaw, 22, 8, 2, "#d8b07a");
  ctx.fillStyle = "#f7f3ea";
  for (let i = 0; i < 4; i += 1) ctx.fillRect(38 + lunge + i * 4, -54, 2, 4);
  ctx.fillStyle = "#fff4c2";
  ctx.fillRect(40 + lunge, -66, 7, 6);
  ctx.fillStyle = "#1a120c";
  ctx.fillRect(44 + lunge, -65, 3, 4);
  ctx.fillRect(38 + lunge, -68, 10, 2);

  ctx.fillStyle = "#009c3b";
  ctx.fillRect(16, -50, 16, 8);
  ctx.fillStyle = "#ffdf00";
  ctx.beginPath();
  ctx.moveTo(24, -49);
  ctx.lineTo(30, -46);
  ctx.lineTo(24, -43);
  ctx.lineTo(18, -46);
  ctx.fill();
  ctx.fillStyle = "#002776";
  ctx.beginPath();
  ctx.arc(24, -46, 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#17243f";
  ctx.fillRect(-4, -46, 6, 14);
  ctx.fillRect(8, -46, 6, 14);
  ctx.fillStyle = "#111";
  ctx.fillRect(-6, -34, 8, 5);
  ctx.fillRect(7, -34, 8, 5);
  box(ctx, -6, -68, 20, 24, 3, "#1b3054");
  ctx.fillStyle = "#f4f4f4";
  ctx.fillRect(2, -64, 5, 14);
  ctx.fillStyle = "#f0c430";
  ctx.fillRect(3, -62, 3, 11);
  ctx.fillStyle = "#009c3b";
  ctx.beginPath();
  ctx.moveTo(-4, -66);
  ctx.lineTo(14, -50);
  ctx.lineTo(16, -46);
  ctx.lineTo(-2, -62);
  ctx.fill();
  ctx.fillStyle = "#ffdf00";
  ctx.beginPath();
  ctx.moveTo(0, -63);
  ctx.lineTo(12, -52);
  ctx.lineTo(14, -49);
  ctx.lineTo(2, -60);
  ctx.fill();

  box(ctx, -1, -84, 16, 16, 3, "#e7b48c");
  ctx.fillStyle = "#161616";
  ctx.fillRect(-1, -88, 16, 6);
  ctx.fillRect(-3, -84, 4, 8);
  ctx.fillRect(11, -86, 5, 6);
  ctx.fillStyle = "#e7b48c";
  ctx.fillRect(-3, -76, 3, 4);
  ctx.fillStyle = "#161616";
  ctx.fillRect(2, -78, 3, 2);
  ctx.fillRect(8, -78, 3, 2);
  ctx.fillRect(1, -81, 5, 2);
  ctx.fillRect(7, -81, 6, 2);
  ctx.fillRect(4, -72, 5, 1);

  const ang = gunAngle(aimX, aimY, 1);
  const len = recoil ? 28 : 34;
  const sx = 16 - (recoil ? 2 : 0);
  const sy = -34;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  ctx.fillStyle = "#1b3054";
  ctx.fillRect(-2, -3, 10, 6);
  ctx.fillStyle = "#e7b48c";
  ctx.fillRect(6, -3, 4, 6);
  ctx.fillStyle = "#2a2a32";
  ctx.fillRect(8, -4, len - 8, 8);
  ctx.fillStyle = "#111";
  ctx.fillRect(len - 6, -3, 6, 6);
  ctx.fillStyle = "#c060ff";
  ctx.fillRect(12, -2, 6, 4);
  ctx.fillStyle = "#f6e6ff";
  ctx.fillRect(13, -1, 2, 2);
  if (recoil) {
    ctx.fillStyle = "rgba(230, 180, 255, 0.95)";
    ctx.beginPath();
    ctx.arc(len, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

function leg(ctx: CanvasRenderingContext2D, x: number, phase: number, jump: boolean): void {
  const swing = jump ? 8 : [8, 1, -8, -1][phase];
  const lift = jump ? 7 : [0, 4, 0, 5][phase];
  ctx.fillStyle = "#7c5834";
  ctx.fillRect(x, -28, 8, 14);
  ctx.fillStyle = "#6a4a2c";
  ctx.fillRect(x + swing, -16 - lift, 7, 14);
  ctx.fillStyle = "#3e2c1c";
  ctx.fillRect(x + swing - 2, -4 - lift, 13, 5);
  ctx.fillStyle = "#f0e6d0";
  ctx.fillRect(x + swing + 9, -3 - lift, 2, 3);
}

export function drawFoe(
  ctx: CanvasRenderingContext2D,
  kind: FoeKind,
  variant: number,
  frame: number,
  wind: number,
  lunge: number,
  time: number,
): void {
  if (kind === "heli") {
    drawHeli(ctx, frame, time);
    return;
  }
  const skins = ["#e7b48c", "#c68642", "#8d5524", "#f1c9a5"];
  const skin = skins[variant % skins.length];
  const bob = kind === "hopper" ? [0, -3, 0, -1][frame & 3] : [0, -1, 0, -2][frame & 3];
  const step = frame & 3;
  ctx.save();
  ctx.translate(lunge, bob);
  const legA = [4, 0, -4, 0][step];
  ctx.fillStyle = "#241c18";
  ctx.fillRect(-8 + legA, -16, 5, 16);
  ctx.fillRect(3 - legA, -16, 5, 16);
  ctx.fillStyle = "#111";
  ctx.fillRect(-9 + legA, -4, 7, 4);
  ctx.fillRect(2 - legA, -4, 7, 4);
  ctx.fillStyle = "#e31818";
  box(ctx, -11, -36, 22, 22, 3, "#e31818");
  ctx.fillStyle = "#a10e0e";
  ctx.fillRect(-11, -28, 22, 4);
  ctx.fillStyle = skin;
  box(ctx, -8, -50, 16, 16, 3, skin);
  ctx.fillStyle = "#161616";
  if (kind === "shooter") {
    ctx.fillRect(-9, -54, 18, 6);
    ctx.fillRect(-11, -50, 4, 4);
  } else if (variant % 2 === 0) {
    ctx.fillRect(-8, -54, 16, 5);
  } else {
    ctx.fillRect(-2, -52, 12, 4);
  }
  ctx.fillRect(-6, -46, 4, 2);
  ctx.fillRect(2, -46, 4, 2);
  if (kind === "shooter" && variant % 2 === 1) {
    ctx.fillStyle = "#111";
    ctx.fillRect(-6, -45, 12, 3);
  }
  ctx.fillStyle = skin;
  if (kind === "grunt") {
    ctx.fillRect(8, -30, 6 + (lunge > 0 ? 4 : 0), 5);
    ctx.fillRect(-14, -30, 5, 5);
  }
  if (kind === "shooter") {
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(6, -30, 16, 4);
    if (wind > 0) {
      ctx.fillStyle = "#ffe14a";
      ctx.fillRect(20, -32, 5, 6);
    }
  }
  if (kind === "grenadier") {
    ctx.fillStyle = "#3a2a18";
    ctx.fillRect(-8, -34, 10, 12);
    ctx.fillStyle = "#3f7d32";
    ctx.beginPath();
    ctx.arc(12, -28, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === "hopper") {
    ctx.fillStyle = "#e31818";
    ctx.fillRect(-12, -18, 8, 6);
    ctx.fillRect(4, -18, 8, 6);
  }
  ctx.restore();
}

function drawHeli(ctx: CanvasRenderingContext2D, frame: number, time: number): void {
  ctx.fillStyle = "#2c3138";
  box(ctx, -26, -28, 40, 16, 6, "#2c3138");
  ctx.fillStyle = "#1a1e24";
  ctx.fillRect(12, -22, 18, 4);
  ctx.fillStyle = "#9fd7e8";
  ctx.fillRect(-16, -25, 12, 8);
  ctx.fillStyle = "#e31818";
  ctx.fillRect(-14, -23, 6, 6);
  ctx.fillStyle = "#e7b48c";
  ctx.fillRect(-12, -28, 5, 5);
  ctx.save();
  ctx.translate(-6, -30);
  ctx.rotate(time * 22 + frame);
  ctx.fillStyle = "#222";
  ctx.fillRect(-24, -1.5, 48, 3);
  ctx.restore();
  ctx.fillStyle = "#666";
  ctx.fillRect(-18, -12, 22, 2);
}

export function drawBoss(
  ctx: CanvasRenderingContext2D,
  frame: number,
  warn: boolean,
  time: number,
): void {
  const wobble = warn ? Math.sin(time * 40) * 1.5 : 0;
  ctx.save();
  ctx.translate(wobble, 0);
  const spin = frame & 3;
  wheel(ctx, -30, spin);
  wheel(ctx, 28, spin);
  box(ctx, -48, -34, 96, 24, 4, "#2a2e33");
  ctx.fillStyle = "#e31818";
  ctx.fillRect(-48, -28, 96, 6);
  ctx.fillStyle = "#3a4048";
  ctx.fillRect(-18, -48, 34, 16);
  ctx.fillStyle = "#9fd7e8";
  ctx.fillRect(-14, -46, 14, 10);
  ctx.fillStyle = "#e31818";
  box(ctx, 16, -66, 22, 28, 3, "#e31818");
  ctx.fillStyle = "#a10e0e";
  ctx.fillRect(16, -54, 22, 5);
  ctx.fillStyle = "#e7b48c";
  box(ctx, 18, -82, 16, 16, 3, "#e7b48c");
  ctx.fillStyle = "#161616";
  ctx.fillRect(18, -86, 16, 6);
  ctx.fillRect(20, -74, 12, 3);
  ctx.fillStyle = "#222";
  ctx.fillRect(32, -60, 26, 6);
  if (warn) {
    ctx.fillStyle = "#ffe14a";
    ctx.fillRect(54, -64, 6, 8);
  }
  ctx.restore();
}

function wheel(ctx: CanvasRenderingContext2D, x: number, spin: number): void {
  ctx.fillStyle = "#161616";
  ctx.beginPath();
  ctx.arc(x, -8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, -8, 4, spin, spin + 1.2);
  ctx.stroke();
}

export function drawPopup(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): void {
  ctx.font = "700 11px Impact, Arial Black, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#1a0a00";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
