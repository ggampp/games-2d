// Trauma-based 2D Screen Shake System

export class ScreenShake {
  constructor() {
    this.trauma = 0; // 0 to 1
    this.maxOffset = 14; // Max pixel shake
    this.maxAngle = 0.04; // Max radian rotation
    this.decay = 2.5; // Trauma decay per second
    this.time = 0;
  }

  addTrauma(amount) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  update(dt) {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.decay * dt);
      this.time += dt * 35;
    }
  }

  apply(ctx, centerX, centerY) {
    if (this.trauma <= 0) return;

    // Shake increases quadratically with trauma for punchy feel
    const shake = this.trauma * this.trauma;
    const offsetX = (Math.sin(this.time * 1.1) + Math.cos(this.time * 0.7)) * 0.5 * this.maxOffset * shake;
    const offsetY = (Math.cos(this.time * 1.3) + Math.sin(this.time * 0.9)) * 0.5 * this.maxOffset * shake;
    const angle = Math.sin(this.time * 0.8) * this.maxAngle * shake;

    ctx.translate(centerX + offsetX, centerY + offsetY);
    ctx.rotate(angle);
    ctx.translate(-centerX, -centerY);
  }
}
