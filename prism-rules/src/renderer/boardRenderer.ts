import {
  LightEmitter,
  Target,
  BlackHole,
  WallObstacle
} from '../engine/types.ts';

export class BoardRenderer {
  private brickPatternCanvas: HTMLCanvasElement | null = null;
  private animTime: number = 0;

  constructor() {
    this.createBrickTexture();
  }

  private createBrickTexture() {
    this.brickPatternCanvas = document.createElement('canvas');
    this.brickPatternCanvas.width = 32;
    this.brickPatternCanvas.height = 16;
    const ctx = this.brickPatternCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#262933';
    ctx.fillRect(0, 0, 32, 16);

    ctx.strokeStyle = '#181a20';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.5, 0.5, 31, 15);

    // Brick highlight
    ctx.strokeStyle = 'rgba(120, 135, 165, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1, 14);
    ctx.lineTo(1, 1);
    ctx.lineTo(31, 1);
    ctx.stroke();
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    emitter: LightEmitter,
    targets: Target[],
    blackHoles: BlackHole[],
    walls: WallObstacle[],
    dt: number
  ) {
    this.animTime += dt;

    // 1. Clear & Dark cosmic background
    const bgGrad = ctx.createRadialGradient(
      width / 2, height / 2, 50,
      width / 2, height / 2, width * 0.72
    );
    bgGrad.addColorStop(0, '#13161f');
    bgGrad.addColorStop(0.6, '#0f1117');
    bgGrad.addColorStop(1, '#090a0d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle grain / cosmic noise texture
    this.renderSubtleNoise(ctx, width, height);

    // 2. Arena Outer Brick Border
    this.renderArenaBrickBorder(ctx, width, height);

    // 3. Walls / Obstacles
    this.renderWalls(ctx, walls);

    // 4. Black Holes (Accretion disk & Event Horizon)
    this.renderBlackHoles(ctx, blackHoles);

    // 5. Light Emitter (Crescent Moon)
    this.renderEmitter(ctx, emitter);

    // 6. Targets (Orbs / Planets / Ruby / Moon)
    this.renderTargets(ctx, targets);
  }

  private renderSubtleNoise(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Subtle star dust / ambient particles
    ctx.save();
    ctx.fillStyle = 'rgba(180, 200, 240, 0.03)';
    for (let i = 0; i < 40; i++) {
      const px = (Math.sin(i * 991.1 + this.animTime * 0.05) * 0.5 + 0.5) * (width - 80) + 40;
      const py = (Math.cos(i * 433.7 + this.animTime * 0.04) * 0.5 + 0.5) * (height - 80) + 40;
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderArenaBrickBorder(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const borderWidth = 28;
    ctx.save();

    // Fill brick border with repeating bricks
    ctx.fillStyle = '#22252e';
    // Top
    ctx.fillRect(0, 0, width, borderWidth);
    // Bottom
    ctx.fillRect(0, height - borderWidth, width, borderWidth);
    // Left
    ctx.fillRect(0, 0, borderWidth, height);
    // Right
    ctx.fillRect(width - borderWidth, 0, borderWidth, height);

    // Individual brick lines
    ctx.strokeStyle = '#15171d';
    ctx.lineWidth = 1.5;

    const brickLen = 22;
    // Horizontal borders
    for (let x = 0; x < width; x += brickLen) {
      ctx.strokeRect(x, 0, brickLen, borderWidth);
      ctx.strokeRect(x, height - borderWidth, brickLen, borderWidth);
    }
    // Vertical borders
    for (let y = 0; y < height; y += brickLen) {
      ctx.strokeRect(0, y, borderWidth, brickLen);
      ctx.strokeRect(width - borderWidth, y, borderWidth, brickLen);
    }

    // Inner subtle glow/bevel
    ctx.strokeStyle = 'rgba(110, 130, 170, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(borderWidth - 1, borderWidth - 1, width - borderWidth * 2 + 2, height - borderWidth * 2 + 2);

    ctx.restore();
  }

  private renderWalls(ctx: CanvasRenderingContext2D, walls: WallObstacle[]) {
    ctx.save();
    for (const w of walls) {
      // Wall background
      ctx.fillStyle = '#2b2f3a';
      ctx.fillRect(w.x, w.y, w.width, w.height);

      // Brick pattern inside wall
      ctx.strokeStyle = '#181a20';
      ctx.lineWidth = 1.5;
      const bW = 22;
      const bH = w.height / 2;

      for (let r = 0; r < 2; r++) {
        const offset = (r % 2) * (bW / 2);
        for (let x = w.x - offset; x < w.x + w.width; x += bW) {
          const drawX = Math.max(w.x, x);
          const drawW = Math.min(w.x + w.width - drawX, bW - (drawX - x));
          if (drawW > 0) {
            ctx.strokeRect(drawX, w.y + r * bH, drawW, bH);
          }
        }
      }

      // Outer border highlight
      ctx.strokeStyle = 'rgba(140, 160, 200, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w.x, w.y, w.width, w.height);
    }
    ctx.restore();
  }

  private renderBlackHoles(ctx: CanvasRenderingContext2D, blackHoles: BlackHole[]) {
    ctx.save();
    for (const bh of blackHoles) {
      // Accretion disk rotation
      const rotSpeed = this.animTime * 1.5;

      // Volumetric accretion glow
      const diskGrad = ctx.createRadialGradient(
        bh.x, bh.y, bh.eventHorizonRadius * 0.8,
        bh.x, bh.y, bh.accretionRadius * 1.5
      );
      diskGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      diskGrad.addColorStop(0.2, 'rgba(255, 240, 210, 0.65)');
      diskGrad.addColorStop(0.5, 'rgba(240, 180, 110, 0.3)');
      diskGrad.addColorStop(0.8, 'rgba(180, 110, 50, 0.1)');
      diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.translate(bh.x, bh.y);

      // Accretion disk outer swirl
      ctx.fillStyle = diskGrad;
      ctx.beginPath();
      ctx.arc(0, 0, bh.accretionRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Swirling photon ring / accretion spiral
      for (let s = 0; s < 3; s++) {
        const spiralAngle = rotSpeed + (s * Math.PI * 2) / 3;
        ctx.strokeStyle = 'rgba(255, 250, 230, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 1.6; a += 0.1) {
          const r = bh.eventHorizonRadius + a * 14;
          const theta = spiralAngle + a;
          const px = r * Math.cos(theta);
          const py = (r * Math.sin(theta)) * 0.7; // slight elliptical perspective
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Bright equatorial flare
      ctx.save();
      ctx.rotate(-0.25);
      const flareGrad = ctx.createLinearGradient(-bh.accretionRadius * 1.8, 0, bh.accretionRadius * 1.8, 0);
      flareGrad.addColorStop(0, 'rgba(240, 190, 120, 0)');
      flareGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
      flareGrad.addColorStop(1, 'rgba(240, 190, 120, 0)');
      ctx.fillStyle = flareGrad;
      ctx.fillRect(-bh.accretionRadius * 1.8, -4, bh.accretionRadius * 3.6, 8);
      ctx.restore();

      // Core event horizon (deep pitch black)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(0, 0, bh.eventHorizonRadius, 0, Math.PI * 2);
      ctx.fill();

      // Sharp photon sphere border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }

  private renderEmitter(ctx: CanvasRenderingContext2D, emitter: LightEmitter) {
    ctx.save();
    ctx.translate(emitter.x, emitter.y);
    ctx.rotate(emitter.angle);

    // Volumetric emission corona
    const coronaGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 65);
    coronaGrad.addColorStop(0, 'rgba(255, 250, 220, 0.8)');
    coronaGrad.addColorStop(0.3, 'rgba(255, 220, 140, 0.4)');
    coronaGrad.addColorStop(0.7, 'rgba(255, 180, 80, 0.15)');
    coronaGrad.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 65, 0, Math.PI * 2);
    ctx.fill();

    // Half-sphere / Crescent Moon emitter body
    const r = 28;
    ctx.save();
    // Dark back hemisphere
    ctx.fillStyle = '#3e4454';
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.5, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();

    // Glowing front golden crescent
    const moonGrad = ctx.createLinearGradient(0, -r, r, 0);
    moonGrad.addColorStop(0, '#ffffff');
    moonGrad.addColorStop(0.4, '#fff2c2');
    moonGrad.addColorStop(1, '#ffc86b');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.quadraticCurveTo(r * 0.2, 0, 0, -r);
    ctx.fill();

    // Inner bright nozzle rim
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  private renderTargets(ctx: CanvasRenderingContext2D, targets: Target[]) {
    ctx.save();
    for (const t of targets) {
      // Update smooth light intensity
      const targetSpeed = 4.0 * 0.016;
      if (t.isLit) {
        t.lightIntensity = Math.min(1.0, t.lightIntensity + targetSpeed);
      } else {
        t.lightIntensity = Math.max(0.0, t.lightIntensity - targetSpeed);
      }

      ctx.save();
      ctx.translate(t.x, t.y);

      if (t.colorType === 'white') {
        // Dusty Moon (Mid-Left) that glows gold when hit
        this.renderDustyMoonTarget(ctx, t);
      } else {
        // Gem Planet Target (Green, Red, Blue)
        this.renderGemOrbTarget(ctx, t);
      }

      ctx.restore();
    }
    ctx.restore();
  }

  private renderGemOrbTarget(ctx: CanvasRenderingContext2D, t: Target) {
    const r = t.radius;
    let mainColor = '#ff2b54';
    let glowColor = 'rgba(255, 43, 84, ';
    let gemColor1 = '#ff829b';
    let gemColor2 = '#c70a32';

    if (t.colorType === 'green') {
      mainColor = '#2ee575';
      glowColor = 'rgba(46, 229, 117, ';
      gemColor1 = '#a0ffca';
      gemColor2 = '#0cb64f';
    } else if (t.colorType === 'blue') {
      mainColor = '#3a82ff';
      glowColor = 'rgba(58, 130, 255, ';
      gemColor1 = '#94c2ff';
      gemColor2 = '#1451c7';
    }

    // Outer pulsating aura when lit
    const auraRadius = r * (1.25 + 0.15 * Math.sin(this.animTime * 3));
    const auraGrad = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, auraRadius);
    auraGrad.addColorStop(0, glowColor + (0.4 + 0.5 * t.lightIntensity) + ')');
    auraGrad.addColorStop(0.6, glowColor + (0.15 + 0.25 * t.lightIntensity) + ')');
    auraGrad.addColorStop(1, glowColor + '0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // Outer Gear / Cog Gold Border
    const teeth = 14;
    ctx.fillStyle = '#caa342';
    ctx.strokeStyle = '#856417';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const angle = (i * Math.PI) / teeth;
      const dist = (i % 2 === 0) ? r : r - 4;
      const gx = Math.cos(angle) * dist;
      const gy = Math.sin(angle) * dist;
      if (i === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner dark circular socket with color accent ring
    ctx.fillStyle = '#1c1f28';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r - 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Core Gem (Ruby / Emerald / Sapphire)
    const gemRadius = (r - 9) * (0.8 + 0.2 * t.lightIntensity);
    const gemGrad = ctx.createRadialGradient(
      -gemRadius * 0.3, -gemRadius * 0.3, 1,
      0, 0, gemRadius
    );

    if (t.lightIntensity > 0.1) {
      gemGrad.addColorStop(0, '#ffffff');
      gemGrad.addColorStop(0.3, gemColor1);
      gemGrad.addColorStop(0.8, gemColor2);
      gemGrad.addColorStop(1, '#1b050d');
    } else {
      gemGrad.addColorStop(0, gemColor1);
      gemGrad.addColorStop(0.5, gemColor2);
      gemGrad.addColorStop(1, '#0e0e14');
    }

    ctx.fillStyle = gemGrad;
    ctx.beginPath();
    ctx.arc(0, 0, gemRadius, 0, Math.PI * 2);
    ctx.fill();

    // Gem specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(-gemRadius * 0.35, -gemRadius * 0.35, gemRadius * 0.3, gemRadius * 0.18, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderDustyMoonTarget(ctx: CanvasRenderingContext2D, t: Target) {
    const r = t.radius;

    // Glowing golden aura when lit
    const auraRadius = r * (1.3 + 0.15 * Math.sin(this.animTime * 2.5));
    const auraGrad = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, auraRadius);
    const goldAlpha = 0.2 + 0.65 * t.lightIntensity;
    auraGrad.addColorStop(0, `rgba(255, 230, 160, ${goldAlpha})`);
    auraGrad.addColorStop(0.5, `rgba(255, 200, 90, ${goldAlpha * 0.4})`);
    auraGrad.addColorStop(1, 'rgba(255, 180, 50, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // Outer Gear / Cog Border
    const teeth = 16;
    ctx.fillStyle = t.lightIntensity > 0.5 ? '#d9b44a' : '#767882';
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const angle = (i * Math.PI) / teeth;
      const dist = (i % 2 === 0) ? r : r - 4;
      const gx = Math.cos(angle) * dist;
      const gy = Math.sin(angle) * dist;
      if (i === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    }
    ctx.closePath();
    ctx.fill();

    // Dusty moon texture / craters
    const moonGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r - 6);
    if (t.lightIntensity > 0.1) {
      moonGrad.addColorStop(0, '#fffbf0');
      moonGrad.addColorStop(0.4, '#ffe79e');
      moonGrad.addColorStop(1, '#8c7028');
    } else {
      moonGrad.addColorStop(0, '#c7cbdb');
      moonGrad.addColorStop(0.5, '#7f8596');
      moonGrad.addColorStop(1, '#3b3f4c');
    }
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
    ctx.fill();

    // Subtle craters
    ctx.fillStyle = t.lightIntensity > 0.5 ? 'rgba(120, 90, 20, 0.2)' : 'rgba(30, 35, 48, 0.25)';
    [
      { cx: -r * 0.25, cy: -r * 0.2, cr: r * 0.18 },
      { cx: r * 0.2, cy: r * 0.3, cr: r * 0.14 },
      { cx: -r * 0.3, cy: r * 0.35, cr: r * 0.12 }
    ].forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, c.cr, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
