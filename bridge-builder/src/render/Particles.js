export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  clear() {
    this.particles = [];
  }

  emitBeamSnap(x, y, color = '#ff5722') {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        size: 2 + Math.random() * 3.5,
        color: Math.random() > 0.4 ? color : '#ffea00',
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
        gravity: 420,
        isConfetti: false
      });
    }
  }

  emitWheelDust(x, y) {
    if (Math.random() > 0.35) return;
    this.particles.push({
      x: x - 4 + Math.random() * 8,
      y: y + 2,
      vx: -15 - Math.random() * 25,
      vy: -10 - Math.random() * 15,
      size: 2.5 + Math.random() * 2.5,
      color: 'rgba(180, 170, 160, 0.4)',
      life: 0.4,
      maxLife: 0.4,
      gravity: -10,
      isConfetti: false
    });
  }

  emitSplash(x, y) {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.85 + Math.random() * Math.PI * 0.7;
      const speed = 60 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 3,
        color: Math.random() > 0.3 ? '#81d4fa' : '#ffffff',
        life: 0.7 + Math.random() * 0.5,
        maxLife: 1.2,
        gravity: 500,
        isConfetti: false
      });
    }
  }

  emitVictoryConfetti(centerX, centerY) {
    const colors = ['#f1c40f', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6', '#e67e22'];
    const count = 60;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const speed = 120 + Math.random() * 240;
      this.particles.push({
        x: centerX + (Math.random() - 0.5) * 100,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 2.0 + Math.random() * 1.0,
        maxLife: 3.0,
        gravity: 280,
        isConfetti: true,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.isConfetti) {
        p.rot += p.rotSpeed * dt;
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.isConfetti) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
