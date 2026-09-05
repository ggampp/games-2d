interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
  /** Traço de vento: desenhado como linha na direção da velocidade. */
  streak: boolean;
}

export class Particles {
  items: Particle[] = [];

  clear(): void {
    this.items = [];
  }

  snap(x: number, y: number, color: string): void {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 50 + Math.random() * 160;
      this.items.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.4 ? color : "#E6B84A",
        life: 0.7 + Math.random() * 0.4,
        maxLife: 1.2,
        gravity: 420,
        streak: false,
      });
    }
  }

  dust(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      this.items.push({
        x: x + (Math.random() - 0.5) * 10,
        y,
        vx: (Math.random() - 0.5) * 40,
        vy: -20 - Math.random() * 30,
        size: 3 + Math.random() * 4,
        color: "rgba(196,187,178,0.5)",
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        gravity: -20,
        streak: false,
      });
    }
  }

  splash(x: number, y: number): void {
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI * 0.85 + Math.random() * Math.PI * 0.7;
      const s = 70 + Math.random() * 160;
      this.items.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: 3 + Math.random() * 3,
        color: Math.random() > 0.3 ? "#7EC8E3" : "#E8EEF2",
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.1,
        gravity: 480,
        streak: false,
      });
    }
  }

  /** Traços de vento cruzando a tela; intensidade 0–1. */
  wind(width: number, top: number, bottom: number, strength: number): void {
    const n = Math.random() < strength * 0.9 ? 2 : 0;
    for (let i = 0; i < n; i++) {
      this.items.push({
        x: -40,
        y: top + Math.random() * (bottom - top),
        vx: 500 + Math.random() * 500 * strength,
        vy: (Math.random() - 0.5) * 30,
        size: 1,
        color: "rgba(232,238,242,0.35)",
        life: width / 600,
        maxLife: width / 600,
        gravity: 0,
        streak: true,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.items) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      if (p.streak) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
