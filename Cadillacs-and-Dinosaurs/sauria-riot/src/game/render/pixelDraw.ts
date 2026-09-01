import type { BodyKind, Palette } from "../../data/fighters.js";

export type Anim =
  | "idle"
  | "walk"
  | "jump"
  | "punch"
  | "punch2"
  | "kick"
  | "special"
  | "hurt"
  | "down"
  | "dead"
  | "shoot";

export interface DrawPose {
  kind: BodyKind;
  id: string;
  palette: Palette;
  anim: Anim;
  t: number;
  facing: 1 | -1;
  air: number;
  weapon: "none" | "pipe" | "gun";
  flash: boolean;
  scale?: number;
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: string,
): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function canvasSize(kind: BodyKind): { w: number; h: number } {
  if (kind === "rex") return { w: 196, h: 148 };
  if (kind === "raptor") return { w: 104, h: 72 };
  if (kind === "brute") return { w: 84, h: 100 };
  return { w: 72, h: 88 };
}

export function drawFighter(ctx: CanvasRenderingContext2D, pose: DrawPose): void {
  const { w, h } = canvasSize(pose.kind);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  const feetX = kindFeetX(pose.kind);
  const feetY = h - 6;
  ctx.translate(feetX, feetY);
  ctx.scale(pose.facing, 1);

  const shadowW = pose.kind === "rex" ? 58 : pose.kind === "raptor" ? 28 : 16;
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 2, shadowW, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -pose.air);

  if (pose.kind === "rex") drawRex(ctx, pose);
  else if (pose.kind === "raptor") drawRaptor(ctx, pose);
  else drawHuman(ctx, pose);

  ctx.restore();
}

function kindFeetX(kind: BodyKind): number {
  if (kind === "rex") return 98;
  if (kind === "raptor") return 44;
  if (kind === "brute") return 42;
  return 36;
}

function drawHuman(ctx: CanvasRenderingContext2D, pose: DrawPose): void {
  const p = pose.palette;
  const skin = hex(p.skin);
  const hair = hex(p.hair);
  const shirt = hex(p.shirt);
  const pants = hex(p.pants);
  const accent = hex(p.accent);
  const boot = hex(p.boot);
  const ink = pose.flash ? "#ffffff" : hex(p.outline);
  const brute = pose.kind === "brute";
  const s = brute ? 1.18 : pose.id === "rook" ? 1.08 : pose.id === "toro" ? 1.12 : 1;
  const t = pose.t;

  let bob = 0;
  let legL = 0;
  let legR = 0;
  let armL = 0;
  let armR = 0;
  let lean = 0;
  let punch = 0;
  let kick = 0;
  let down = false;

  if (pose.anim === "idle") bob = Math.sin(t * 6) * 1;
  if (pose.anim === "walk") {
    const ph = t * 10;
    bob = Math.abs(Math.sin(ph)) * 1.5;
    legL = Math.sin(ph) * 9;
    legR = Math.sin(ph + Math.PI) * 9;
    armL = Math.sin(ph + Math.PI) * 6;
    armR = Math.sin(ph) * 6;
  }
  if (pose.anim === "jump") {
    bob = -2;
    legL = -6;
    legR = 4;
    armL = -8;
    armR = 6;
  }
  if (pose.anim === "punch") {
    punch = 16;
    armR = 14;
    lean = 3;
  }
  if (pose.anim === "punch2") {
    punch = 20;
    armL = 16;
    lean = 4;
  }
  if (pose.anim === "kick") {
    kick = 18;
    lean = 2;
  }
  if (pose.anim === "special") {
    punch = pose.id === "vesper" ? 24 : 18;
    lean = 6;
    armR = 18;
  }
  if (pose.anim === "shoot") {
    armR = 12;
    punch = 8;
    lean = 2;
  }
  if (pose.anim === "hurt") {
    lean = -7;
    armL = -6;
    armR = -4;
  }
  if (pose.anim === "down" || pose.anim === "dead") down = true;

  if (down) {
    px(ctx, -22, -10, 40, 8, ink);
    px(ctx, -20, -12, 36, 8, pants);
    px(ctx, 8, -16, 12, 10, shirt);
    px(ctx, 16, -22, 10, 10, skin);
    px(ctx, 18, -24, 10, 5, hair);
    return;
  }

  ctx.translate(lean, bob);

  const tw = Math.round(12 * s);
  const th = Math.round(16 * s);
  const hw = Math.round(10 * s);
  const hh = Math.round(10 * s);

  // back arm
  px(ctx, -10, -38 + armL, 5, 13, ink);
  px(ctx, -9, -37 + armL, 3, 11, skin);

  // legs
  px(ctx, -8 + Math.min(0, legL * 0.3), -20 + Math.max(0, -legL * 0.15), 7, 16, ink);
  px(ctx, -7 + Math.min(0, legL * 0.3), -19, 5, 14, pants);
  px(ctx, -8 + Math.min(0, legL * 0.3) + kick * 0.1, -6, 8, 5, boot);

  px(ctx, 1 + Math.max(0, legR * 0.3) + kick, -20, 7, 16 + (kick ? -6 : 0), ink);
  px(ctx, 2 + Math.max(0, legR * 0.3) + kick, -19, 5, 14, pants);
  px(ctx, 1 + kick, -6, 8, 5, boot);

  // hips / torso
  px(ctx, -tw / 2 - 1, -40, tw + 2, th + 8, ink);
  px(ctx, -tw / 2, -28, tw, 10, pants);
  px(ctx, -tw / 2, -40, tw, th, shirt);
  px(ctx, -tw / 2, -28, tw, 3, accent);

  // head
  px(ctx, -hw / 2 - 1, -40 - hh - 1, hw + 2, hh + 2, ink);
  px(ctx, -hw / 2, -40 - hh, hw, hh, skin);
  px(ctx, -hw / 2, -40 - hh, hw, 4, hair);
  px(ctx, hw / 2 - 3, -40 - hh + 5, 2, 2, ink);

  if (pose.id === "vesper") {
    px(ctx, -hw / 2 + 1, -40 - hh + 1, 3, 6, accent);
  }
  if (pose.id === "quinn") {
    px(ctx, -hw / 2 - 1, -40 - hh + 1, hw + 2, 3, accent);
    px(ctx, hw / 2 - 1, -40 - hh + 2, 5, 3, accent);
  }
  if (pose.id === "toro") {
    px(ctx, -6, -36, 4, 3, hex(p.accent));
    px(ctx, 2, -36, 4, 3, hex(p.accent));
  }

  // front arm / punch
  const ax = 6 + punch;
  px(ctx, ax, -38 + armR, 5, 13, ink);
  px(ctx, ax + 1, -37 + armR, 3, 11, skin);

  if (pose.weapon === "pipe" || pose.id === "rook" && pose.anim === "special") {
    px(ctx, ax + 3, -42 + armR, 3, 22, accent);
  }
  if (pose.weapon === "gun" || pose.anim === "shoot") {
    px(ctx, ax + 3, -36 + armR, 10, 4, hex(0x2a2a30));
    px(ctx, ax + 10, -37 + armR, 4, 3, hex(0x1a1a20));
  }
  if (pose.id === "vesper") {
    px(ctx, ax + 2, -40 + armR, 10, 2, accent);
  }
}

function drawRaptor(ctx: CanvasRenderingContext2D, pose: DrawPose): void {
  const p = pose.palette;
  const body = pose.flash ? "#ffffff" : hex(p.skin);
  const dark = hex(p.pants);
  const belly = hex(p.accent);
  const ink = pose.flash ? "#ffffff" : hex(p.outline);
  const t = pose.t;
  const run = pose.anim === "walk" || pose.anim === "special" ? Math.sin(t * 14) * 6 : 0;
  const bite = pose.anim === "punch" || pose.anim === "special" ? 10 : 0;
  const down = pose.anim === "down" || pose.anim === "dead";

  if (down) {
    px(ctx, -30, -14, 50, 10, ink);
    px(ctx, -28, -16, 46, 8, body);
    return;
  }

  // tail
  px(ctx, -40, -18 + run * 0.3, 22, 7, ink);
  px(ctx, -38, -16 + run * 0.3, 20, 5, dark);
  // body
  px(ctx, -18, -28, 34, 18, ink);
  px(ctx, -16, -26, 30, 14, body);
  px(ctx, -10, -18, 20, 6, belly);
  // legs
  px(ctx, -8, -12 + run, 7, 12, ink);
  px(ctx, -6, -10 + run, 4, 10, dark);
  px(ctx, 6, -12 - run, 7, 12, ink);
  px(ctx, 8, -10 - run, 4, 10, dark);
  // head / snout
  px(ctx, 12 + bite, -36, 22, 14, ink);
  px(ctx, 14 + bite, -34, 18, 10, body);
  px(ctx, 24 + bite, -30, 10, 4, dark);
  px(ctx, 16 + bite, -32, 3, 3, ink);
  px(ctx, 8, -38, 8, 6, hex(p.hair));
}

function drawRex(ctx: CanvasRenderingContext2D, pose: DrawPose): void {
  const p = pose.palette;
  const hide = pose.flash ? "#ffffff" : hex(p.skin);
  const dark = hex(p.pants);
  const metal = hex(p.accent);
  const ink = pose.flash ? "#ffffff" : hex(p.outline);
  const t = pose.t;
  const step = pose.anim === "walk" ? Math.sin(t * 7) * 8 : 0;
  const roar = pose.anim === "punch" || pose.anim === "special" || pose.anim === "shoot" ? 16 : 0;
  const down = pose.anim === "down" || pose.anim === "dead";

  if (down) {
    px(ctx, -70, -28, 130, 22, ink);
    px(ctx, -66, -32, 122, 18, hide);
    px(ctx, 40, -44, 36, 20, metal);
    return;
  }

  px(ctx, -90, -40 + step * 0.2, 50, 16, ink);
  px(ctx, -86, -36 + step * 0.2, 46, 12, dark);

  px(ctx, -40, -78, 70, 50, ink);
  px(ctx, -36, -74, 62, 42, hide);
  px(ctx, -20, -48, 40, 14, hex(p.shirt));

  px(ctx, -18, -28 + step, 16, 28, ink);
  px(ctx, -14, -24 + step, 10, 22, dark);
  px(ctx, 8, -28 - step, 16, 28, ink);
  px(ctx, 12, -24 - step, 10, 22, dark);

  px(ctx, 22, -70, 14, 10, ink);
  px(ctx, 24, -68, 10, 6, hide);

  px(ctx, 24 + roar * 0.2, -108, 58, 42, ink);
  px(ctx, 28 + roar * 0.2, -104, 50, 34, hide);
  px(ctx, 48 + roar, -90, 36, 16, metal);
  px(ctx, 52 + roar, -86, 28, 8, hex(0x2a3038));
  px(ctx, 34, -98, 6, 6, ink);
  px(ctx, 28, -112, 18, 10, dark);
}
