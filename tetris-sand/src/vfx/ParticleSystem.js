// High-performance Particle FX, Shockwaves & Floating Texts

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
  }

  reset() {
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
  }

  spawnSandExplosion(clearedGrains, scaleX, scaleY, palette) {
    const step = Math.max(1, Math.floor(clearedGrains.length / 220));

    for (let i = 0; i < clearedGrains.length; i += step) {
      const g = clearedGrains[i];
      const colorDef = palette.colors[g.color] || { hex: '#ffffff' };

      const px = (g.x + 0.5) * scaleX;
      const py = (g.y + 0.5) * scaleY;

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 100 + 40;

      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        gravity: 180,
        color: colorDef.hex,
        size: Math.random() * 3.5 + 1.5,
        life: 1.0,
        decay: Math.random() * 1.5 + 1.2,
        sparkle: Math.random() > 0.3
      });
    }
  }

  spawnBombExplosion(centerX, centerY, scaleX, scaleY) {
    const px = (centerX + 0.5) * scaleX;
    const py = (centerY + 0.5) * scaleY;

    // Expanding shockwave ring
    this.shockwaves.push({
      x: px,
      y: py,
      radius: 5,
      maxRadius: 85,
      color: '#ff3366',
      lineWidth: 5,
      life: 1.0,
      decay: 2.5
    });

    // Fireball sparks
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 220 + 80;
      const colors = ['#ff3366', '#ff9900', '#ffff00', '#ffffff'];
      const col = colors[Math.floor(Math.random() * colors.length)];

      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 80,
        color: col,
        size: Math.random() * 4 + 2,
        life: 1.0,
        decay: Math.random() * 2.0 + 1.5,
        sparkle: true
      });
    }
  }

  spawnLaserBeam(centerY, scaleY, width) {
    const py = (centerY + 0.5) * scaleY;

    for (let i = 0; i < 70; i++) {
      const px = Math.random() * width;
      this.particles.push({
        x: px,
        y: py + (Math.random() * 12 - 6),
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 60,
        gravity: 0,
        color: '#ffea00',
        size: Math.random() * 3 + 1,
        life: 0.8,
        decay: 2.5,
        sparkle: true
      });
    }
  }

  spawnAcidBubbles(centerX, centerY, scaleX, scaleY) {
    const px = (centerX + 0.5) * scaleX;
    const py = (centerY + 0.5) * scaleY;

    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: px + (Math.random() * 20 - 10),
        y: py + (Math.random() * 20 - 10),
        vx: (Math.random() - 0.5) * 30,
        vy: -Math.random() * 50 - 20,
        gravity: -10,
        color: '#39ff14',
        size: Math.random() * 2.5 + 1,
        life: 0.6,
        decay: 1.8,
        sparkle: false
      });
    }
  }

  spawnImpactDust(blockX, blockY, width, scaleX, scaleY, colorHex) {
    const startX = blockX * scaleX;
    const endX = (blockX + width) * scaleX;
    const py = blockY * scaleY;

    for (let i = 0; i < 24; i++) {
      const px = startX + Math.random() * (endX - startX);
      const angle = (Math.random() * Math.PI) - Math.PI;

      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * (Math.random() * 70 + 20),
        vy: Math.sin(angle) * (Math.random() * 60 + 20),
        gravity: 120,
        color: colorHex || '#ffffff',
        size: Math.random() * 2.5 + 1,
        life: 0.7,
        decay: 2.2,
        sparkle: false
      });
    }
  }

  addFloatingText(text, x, y, color = '#ffeb3b', fontSize = 20, isBig = false) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      fontSize,
      isBig,
      life: 1.0,
      decay: isBig ? 0.7 : 1.2,
      vy: -50
    });
  }

  update(dt) {
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }

    // Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= sw.decay * dt;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      sw.radius += (sw.maxRadius - sw.radius) * dt * 10;
    }

    // Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= ft.decay * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
    }
  }

  render(ctx) {
    // Shockwaves
    ctx.save();
    for (const sw of this.shockwaves) {
      ctx.globalAlpha = Math.max(0, sw.life);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.lineWidth * sw.life;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Particles
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;

      if (p.sparkle && Math.random() > 0.5) {
        ctx.fillStyle = '#ffffff';
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Floating texts
    ctx.save();
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, Math.min(1, ft.life * 1.3));
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${ft.fontSize}px 'Outfit', 'Inter', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = ft.color;
      ctx.shadowBlur = ft.isBig ? 16 : 8;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }
}
