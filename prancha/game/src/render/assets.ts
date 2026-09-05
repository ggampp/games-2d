import { BIOMES } from "../levels/catalog.ts";
import { MATERIALS } from "../sim/materials.ts";
import { VEHICLES } from "../sim/vehicle.ts";

const STATIC_PATHS = [
  "/assets/sprites/structures/abut_left.png",
  "/assets/sprites/structures/abut_right.png",
  "/assets/sprites/structures/pier.png",
  "/assets/sprites/structures/scaffold.png",
  "/assets/sprites/materials/mat_joint_node.png",
];

export class AssetBank {
  private images = new Map<string, HTMLImageElement>();
  private stripes = new Map<string, CanvasPattern | null>();

  async load(): Promise<void> {
    const paths = new Set(STATIC_PATHS);
    for (const m of Object.values(MATERIALS)) {
      paths.add(m.icon);
      paths.add(m.sprite);
    }
    for (const v of Object.values(VEHICLES)) paths.add(v.sprite);
    for (const b of Object.values(BIOMES)) paths.add(b.plate);
    await Promise.all([...paths].map((path) => this.loadOne(path)));
  }

  get(path: string): HTMLImageElement | undefined {
    return this.images.get(path);
  }

  /** Padrão hachurado (zonas proibidas), cacheado por cor. */
  hatch(ctx: CanvasRenderingContext2D, color: string): CanvasPattern | null {
    const cached = this.stripes.get(color);
    if (cached !== undefined) return cached;
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 16;
    const g = c.getContext("2d");
    if (!g) return null;
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-4, 20);
    g.lineTo(20, -4);
    g.moveTo(-4, 4);
    g.lineTo(4, -4);
    g.moveTo(12, 20);
    g.lineTo(20, 12);
    g.stroke();
    const p = ctx.createPattern(c, "repeat");
    this.stripes.set(color, p);
    return p;
  }

  private loadOne(path: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(path, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = path;
    });
  }
}
