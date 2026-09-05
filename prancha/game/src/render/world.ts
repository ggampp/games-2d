import type { BiomeDef } from "../levels/catalog.ts";
import { stressTint } from "../sim/beam.ts";
import type { Beam } from "../sim/beam.ts";
import type { BridgeSystem } from "../sim/bridge.ts";
import type { Member } from "../sim/member.ts";
import type { SimNode } from "../sim/node.ts";
import type { Vehicle } from "../sim/vehicle.ts";
import { brl } from "../sim/scoring.ts";
import type { AssetBank } from "./assets.ts";
import { Backdrop } from "./backdrop.ts";
import type { Particles } from "./particles.ts";

export interface Preview {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  color: string;
  meters: number;
  valid: boolean;
  note?: string;
}

export interface RenderState {
  bridge: BridgeSystem;
  vehicles: Vehicle[];
  particles: Particles;
  mode: "build" | "test";
  preview: Preview | null;
  hoverNode: SimNode | null;
  hoverMember: Member | null;
  shake: { x: number; y: number };
  biome: BiomeDef;
  waterY: number;
  time: number;
}

const MONO = "600 13px 'IBM Plex Mono', monospace";

export class WorldRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly assets: AssetBank;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly backdrop = new Backdrop();

  constructor(canvas: HTMLCanvasElement, assets: AssetBank) {
    this.canvas = canvas;
    this.assets = assets;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("canvas 2d indisponível");
    this.ctx = c;
  }

  render(s: RenderState): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(s.shake.x, s.shake.y);

    this.drawBackground(ctx, width, height, s);
    this.drawAbutments(ctx, s.bridge);
    this.drawBed(ctx, s);
    this.drawZones(ctx, s);
    if (s.mode === "build") this.drawGrid(ctx, s.bridge);
    this.drawMembers(ctx, s);
    if (s.preview) this.drawPreview(ctx, s.preview);
    this.drawNodes(ctx, s);
    this.drawSpanCota(ctx, s.bridge);
    if (s.mode === "test") this.drawDeflection(ctx, s.bridge);
    for (const v of s.vehicles) this.drawVehicle(ctx, v, s.mode);
    this.drawWater(ctx, width, height, s);
    s.particles.draw(ctx);
    ctx.restore();
  }

  // ---------- cenário ----------

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, s: RenderState): void {
    const img = this.assets.get(s.biome.plate);
    if (!img) {
      ctx.drawImage(this.backdrop.get(s.bridge.layout), 0, 0);
      return;
    }
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    // véu de prancheta: mantém a leitura das cotas e das cores de esforço
    ctx.fillStyle = "rgba(11, 31, 58, 0.3)";
    ctx.fillRect(0, 0, w, h);
    const { leftX, rightX, deckY, bedY } = s.bridge.layout;
    ctx.fillStyle = "rgba(11, 25, 44, 0.5)";
    ctx.beginPath();
    ctx.moveTo(leftX, deckY + 8);
    ctx.lineTo(leftX - 40, bedY + 30);
    ctx.lineTo(rightX + 40, bedY + 30);
    ctx.lineTo(rightX, deckY + 8);
    ctx.closePath();
    ctx.fill();
  }

  private drawWater(ctx: CanvasRenderingContext2D, w: number, h: number, s: RenderState): void {
    const y = s.waterY;
    const wg = ctx.createLinearGradient(0, y - 10, 0, h);
    wg.addColorStop(0, "rgba(40, 90, 120, 0.0)");
    wg.addColorStop(0.08, s.biome.water);
    wg.addColorStop(1, "rgba(8, 20, 36, 0.92)");
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 20) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + s.time * 1.6) * 2.5);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(126, 200, 227, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 20) {
      const yy = y + Math.sin(x * 0.02 + s.time * 1.6) * 2.5;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  private drawAbutments(ctx: CanvasRenderingContext2D, bridge: BridgeSystem): void {
    const { leftX, rightX, deckY, bedY } = bridge.layout;
    const left = this.assets.get("/assets/sprites/structures/abut_left.png");
    const right = this.assets.get("/assets/sprites/structures/abut_right.png");
    const h = Math.min(bedY - deckY + 120, this.canvas.height - (deckY - 28));
    const w = h * 0.36;
    if (left) ctx.drawImage(left, leftX - w + 8, deckY - 28, w, h);
    else this.block(ctx, 0, deckY, leftX, bedY - deckY + 80);
    if (right) ctx.drawImage(right, rightX - 8, deckY - 28, w, h);
    else this.block(ctx, rightX, deckY, this.canvas.width - rightX, bedY - deckY + 80);

    ctx.fillStyle = "#2A3038";
    ctx.fillRect(0, deckY - 5, leftX, 8);
    ctx.fillRect(rightX, deckY - 5, this.canvas.width - rightX, 8);
    ctx.strokeStyle = "#C9A227";
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, deckY - 1);
    ctx.lineTo(leftX - 6, deckY - 1);
    ctx.moveTo(rightX + 6, deckY - 1);
    ctx.lineTo(this.canvas.width, deckY - 1);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private block(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = "#C4BBB2";
    ctx.fillRect(x, y, w, h);
  }

  private drawBed(ctx: CanvasRenderingContext2D, s: RenderState): void {
    const b = s.bridge;
    const { bedY } = b.layout;
    const [x0, x1] = b.pierRange();
    ctx.fillStyle = "rgba(60, 45, 30, 0.7)";
    ctx.fillRect(b.layout.leftX - 60, bedY, b.layout.rightX - b.layout.leftX + 120, 60);
    if (!b.piersAllowed) {
      if (s.mode === "build") {
        ctx.fillStyle = "rgba(209, 73, 91, 0.8)";
        ctx.font = MONO;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("LEITO INTERDITADO: PROIBIDO PILAR", (b.layout.leftX + b.layout.rightX) / 2, bedY + 24);
      }
      return;
    }
    ctx.strokeStyle = s.mode === "build" ? "rgba(201, 162, 39, 0.9)" : "rgba(201, 162, 39, 0.45)";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, bedY);
    ctx.lineTo(x1, bedY);
    ctx.stroke();
    ctx.setLineDash([]);
    if (s.mode === "build") {
      ctx.fillStyle = "rgba(201, 162, 39, 0.9)";
      ctx.font = MONO;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`LEITO: FUNDAÇÃO ${brl(b.foundationCost())} / un`, (x0 + x1) / 2, bedY + 24);
    }
  }

  private drawZones(ctx: CanvasRenderingContext2D, s: RenderState): void {
    const pattern = this.assets.hatch(ctx, "rgba(209, 73, 91, 0.45)");
    for (const z of s.bridge.zones) {
      const y1 = Math.min(z.y1, s.waterY);
      ctx.fillStyle = pattern ?? "rgba(209, 73, 91, 0.2)";
      ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, y1 - z.y0);
      ctx.strokeStyle = "rgba(209, 73, 91, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(z.x0, z.y0, z.x1 - z.x0, y1 - z.y0);
      ctx.fillStyle = "#D1495B";
      ctx.font = MONO;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(z.label, (z.x0 + z.x1) / 2, z.y0 + 6);
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D, bridge: BridgeSystem): void {
    const { leftX, rightX, deckY, snapPx, topY, bedY, waterY } = bridge.layout;
    const bot = bridge.piersAllowed ? bedY : waterY - 30;
    ctx.strokeStyle = "rgba(126, 200, 227, 0.13)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = leftX - snapPx * 2; x <= rightX + snapPx * 2 + 1; x += snapPx) {
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bot);
    }
    for (let y = deckY; y >= topY; y -= snapPx) {
      ctx.moveTo(leftX - snapPx * 2, y);
      ctx.lineTo(rightX + snapPx * 2, y);
    }
    for (let y = deckY + snapPx; y <= bot; y += snapPx) {
      ctx.moveTo(leftX - snapPx * 2, y);
      ctx.lineTo(rightX + snapPx * 2, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(126, 200, 227, 0.35)";
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(leftX - snapPx * 2, topY);
    ctx.lineTo(rightX + snapPx * 2, topY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---------- estrutura ----------

  private drawMembers(ctx: CanvasRenderingContext2D, s: RenderState): void {
    const ppm = s.bridge.layout.ppm;
    const widthScale = Math.max(0.55, ppm / 48);
    for (const m of s.bridge.members) {
      const hovered = s.hoverMember === m;
      const img = this.assets.get(m.material.sprite);
      const w = Math.max(3, m.material.width * widthScale);
      for (const seg of m.segments) {
        this.drawSegment(ctx, seg, m, img, w, hovered, s.mode);
      }
    }
  }

  private drawSegment(
    ctx: CanvasRenderingContext2D,
    seg: Beam,
    m: Member,
    img: HTMLImageElement | undefined,
    w: number,
    hovered: boolean,
    mode: "build" | "test",
  ): void {
    const a = seg.nodeA.pos;
    const b = seg.nodeB.pos;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const angle = Math.atan2(dy, dx);

    if (seg.isBroken) {
      ctx.strokeStyle = "#5A3030";
      ctx.lineWidth = Math.max(2, w * 0.7);
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + dx * 0.4, a.y + dy * 0.4);
      ctx.moveTo(a.x + dx * 0.6, a.y + dy * 0.6);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    if (m.material.tensionOnly) {
      ctx.strokeStyle = mode === "test" ? stressTint(seg.displayStress, false, seg.slack) : m.material.color;
      ctx.lineWidth = w;
      ctx.setLineDash(seg.slack ? [3, 6] : [8, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (hovered) this.outline(ctx, a.x, a.y, b.x, b.y, w + 4, "#7EC8E3");
      return;
    }

    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(angle);
    if (m.locked) {
      ctx.strokeStyle = "rgba(201, 162, 39, 0.9)";
      ctx.lineWidth = w + 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
    }
    if (img) {
      const sx = img.width * 0.18;
      const sw = img.width * 0.64;
      ctx.drawImage(img, sx, 0, sw, img.height, -1, -w / 2, len + 2, w);
    } else {
      ctx.fillStyle = m.material.color;
      ctx.fillRect(-1, -w / 2, len + 2, w);
    }
    if (mode === "test") {
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = stressTint(seg.displayStress, false, false);
      ctx.fillRect(-1, -w / 2, len + 2, w);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = m.material.highlight;
      ctx.fillRect(0, -w / 2, len, Math.max(1, w * 0.22));
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (hovered) this.outline(ctx, a.x, a.y, b.x, b.y, w + 4, m.locked ? "#D1495B" : "#7EC8E3");
  }

  private outline(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(Math.atan2(by - ay, bx - ax));
    ctx.strokeRect(-2, -w / 2, Math.hypot(bx - ax, by - ay) + 4, w);
    ctx.restore();
  }

  private drawPreview(ctx: CanvasRenderingContext2D, p: Preview): void {
    ctx.strokeStyle = p.valid ? p.color : "#D1495B";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(p.ax, p.ay);
    ctx.lineTo(p.bx, p.by);
    ctx.stroke();
    ctx.setLineDash([]);
    const mx = (p.ax + p.bx) / 2;
    const my = (p.ay + p.by) / 2 - 18;
    const label = p.note ? `${p.meters.toFixed(2)} m · ${p.note}` : `${p.meters.toFixed(2)} m`;
    ctx.font = MONO;
    const tw = ctx.measureText(label).width + 14;
    ctx.fillStyle = "#0B1F3A";
    ctx.strokeStyle = p.valid ? "#7EC8E3" : "#D1495B";
    ctx.lineWidth = 1;
    ctx.fillRect(mx - tw / 2, my - 12, tw, 22);
    ctx.strokeRect(mx - tw / 2, my - 12, tw, 22);
    ctx.fillStyle = p.valid ? "#E8EEF2" : "#D1495B";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, mx, my - 1);
  }

  private drawNodes(ctx: CanvasRenderingContext2D, s: RenderState): void {
    const { bedY } = s.bridge.layout;
    for (const node of s.bridge.nodes) {
      const hover = s.hoverNode === node;
      const r = hover ? node.radius + 3 : node.radius;
      if (node.isFoundation) {
        ctx.fillStyle = "#C4BBB2";
        ctx.fillRect(node.pos.x - 14, bedY - 4, 28, 18);
        ctx.fillStyle = "#8A9AA8";
        ctx.fillRect(node.pos.x - 10, bedY + 14, 20, 6);
      }
      ctx.beginPath();
      ctx.arc(node.pos.x, node.pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = node.isAnchor ? "#C9A227" : "#E8EEF2";
      ctx.fill();
      ctx.strokeStyle = hover ? "#7EC8E3" : "#0B1F3A";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (s.mode === "build" && node.isAnchor) {
        ctx.strokeStyle = "rgba(201, 162, 39, 0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(node.pos.x, node.pos.y, r + 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawSpanCota(ctx: CanvasRenderingContext2D, bridge: BridgeSystem): void {
    const { leftX, rightX, deckY, spanM, topY } = bridge.layout;
    const y = Math.max(topY - 18, 84);
    ctx.strokeStyle = "#7EC8E3";
    ctx.fillStyle = "#7EC8E3";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(leftX, y - 8);
    ctx.lineTo(leftX, y + 8);
    ctx.moveTo(rightX, y - 8);
    ctx.lineTo(rightX, y + 8);
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = "rgba(126, 200, 227, 0.35)";
    ctx.beginPath();
    ctx.moveTo(leftX, y + 8);
    ctx.lineTo(leftX, deckY - 12);
    ctx.moveTo(rightX, y + 8);
    ctx.lineTo(rightX, deckY - 12);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = MONO;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`VÃO ${spanM.toFixed(2)} m`, (leftX + rightX) / 2, y - 8);
  }

  private drawDeflection(ctx: CanvasRenderingContext2D, bridge: BridgeSystem): void {
    let worst: SimNode | null = null;
    let drop = 0;
    for (const n of bridge.nodes) {
      if (n.isAnchor || !n.isRoad) continue;
      const d = n.pos.y - n.baseY;
      if (d > drop) {
        drop = d;
        worst = n;
      }
    }
    if (!worst || drop < 3) return;
    const x = worst.pos.x;
    const y0 = worst.baseY;
    const y1 = worst.pos.y;
    ctx.strokeStyle = "rgba(230, 184, 74, 0.9)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x - 60, y0);
    ctx.lineTo(x + 60, y0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x + 40, y0);
    ctx.lineTo(x + 40, y1);
    ctx.stroke();
    ctx.fillStyle = "#E6B84A";
    ctx.font = MONO;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`f = ${((drop / bridge.layout.ppm) * 1000).toFixed(0)} mm`, x + 46, (y0 + y1) / 2);
  }

  private drawVehicle(ctx: CanvasRenderingContext2D, vehicle: Vehicle, mode: "build" | "test"): void {
    const img = this.assets.get(vehicle.spec.sprite);
    ctx.save();
    ctx.translate(vehicle.pos.x, vehicle.pos.y);
    ctx.rotate(vehicle.angle);
    if (vehicle.dir === -1) ctx.scale(-1, 1);
    ctx.globalAlpha = mode === "build" ? 0.35 : vehicle.active ? 1 : 0.5;
    const w = vehicle.spec.chassisWidth;
    const h = vehicle.spec.chassisHeight;
    if (img) {
      ctx.drawImage(img, -w * 0.52, -h * 0.7, w * 1.12, h * 1.05);
    } else {
      ctx.fillStyle = "#E8EEF2";
      ctx.fillRect(-w / 2, -h, w, h);
    }
    ctx.restore();
    if (mode === "test" && vehicle.active && !vehicle.hasFinished && !vehicle.hasFallen) {
      ctx.fillStyle = "rgba(232, 238, 242, 0.85)";
      ctx.font = MONO;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${vehicle.loadT} t`, vehicle.pos.x, vehicle.pos.y - vehicle.spec.chassisHeight * 0.8);
    }
  }
}
