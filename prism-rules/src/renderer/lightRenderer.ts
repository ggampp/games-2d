import {
  RaySegment,
  OpticalPiece
} from '../engine/types.ts';

export class LightRenderer {
  public renderLightBeams(ctx: CanvasRenderingContext2D, rays: RaySegment[]) {
    ctx.save();

    // 1. First Pass: Wide Volumetric Soft Glow (Additive Screen Blending)
    ctx.globalCompositeOperation = 'screen';
    for (const ray of rays) {
      if (ray.path.length < 2) continue;

      ctx.strokeStyle = ray.color;
      ctx.lineWidth = ray.width * 3.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.15;

      ctx.beginPath();
      ctx.moveTo(ray.path[0].x, ray.path[0].y);
      for (let i = 1; i < ray.path.length; i++) {
        ctx.lineTo(ray.path[i].x, ray.path[i].y);
      }
      ctx.stroke();
    }

    // 2. Second Pass: Medium Intensity Core Bloom
    for (const ray of rays) {
      if (ray.path.length < 2) continue;

      ctx.strokeStyle = ray.color;
      ctx.lineWidth = ray.width * 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.35;

      ctx.beginPath();
      ctx.moveTo(ray.path[0].x, ray.path[0].y);
      for (let i = 1; i < ray.path.length; i++) {
        ctx.lineTo(ray.path[i].x, ray.path[i].y);
      }
      ctx.stroke();
    }

    // 3. Third Pass: Intense Sharp Filament
    ctx.globalCompositeOperation = 'lighter';
    for (const ray of rays) {
      if (ray.path.length < 2) continue;

      // Solid inner core
      ctx.strokeStyle = ray.isRainbow ? ray.color : 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = Math.max(1.5, ray.width * 0.9);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.9;

      ctx.beginPath();
      ctx.moveTo(ray.path[0].x, ray.path[0].y);
      for (let i = 1; i < ray.path.length; i++) {
        ctx.lineTo(ray.path[i].x, ray.path[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  public renderPieces(ctx: CanvasRenderingContext2D, pieces: OpticalPiece[]) {
    ctx.save();
    for (const p of pieces) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      switch (p.type) {
        case 'prism':
          this.renderPrismPiece(ctx, p);
          break;
        case 'mirror':
          this.renderMirrorPiece(ctx, p);
          break;
        case 'green':
          this.renderGreenSplitterPiece(ctx, p);
          break;
        case 'lens':
          this.renderLensPiece(ctx, p);
          break;
      }

      ctx.restore();
    }
    ctx.restore();
  }

  private renderPrismPiece(ctx: CanvasRenderingContext2D, p: OpticalPiece) {
    const r = p.size || 50;
    // Local equilateral triangle centered at origin
    const pts = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
      pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }

    // Glass body fill
    const glassGrad = ctx.createLinearGradient(pts[0].x, pts[0].y, 0, r);
    glassGrad.addColorStop(0, 'rgba(245, 250, 255, 0.45)');
    glassGrad.addColorStop(0.5, 'rgba(215, 235, 255, 0.25)');
    glassGrad.addColorStop(1, 'rgba(180, 210, 255, 0.35)');
    ctx.fillStyle = glassGrad;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.closePath();
    ctx.fill();

    // Brilliant glass edges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner refraction facet reflection
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * 0.7, pts[0].y * 0.7);
    ctx.lineTo(pts[1].x * 0.7, pts[1].y * 0.7);
    ctx.lineTo(pts[2].x * 0.7, pts[2].y * 0.7);
    ctx.closePath();
    ctx.stroke();
  }

  private renderMirrorPiece(ctx: CanvasRenderingContext2D, p: OpticalPiece) {
    const len = p.size || 70;
    const thickness = 7;

    // Back metal bracket
    ctx.fillStyle = '#3a404d';
    ctx.fillRect(-thickness, -len / 2, thickness, len);

    // Front reflective silver mirror surface
    const mirrorGrad = ctx.createLinearGradient(0, -len / 2, 0, len / 2);
    mirrorGrad.addColorStop(0, '#dbe2ea');
    mirrorGrad.addColorStop(0.5, '#ffffff');
    mirrorGrad.addColorStop(1, '#c2cbd7');
    ctx.fillStyle = mirrorGrad;
    ctx.fillRect(0, -len / 2, 3, len);

    // Front reflective line glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(3, -len / 2);
    ctx.lineTo(3, len / 2);
    ctx.stroke();

    // Metallic frame border
    ctx.strokeStyle = '#1e222a';
    ctx.lineWidth = 1;
    ctx.strokeRect(-thickness, -len / 2, thickness + 3, len);
  }

  private renderGreenSplitterPiece(ctx: CanvasRenderingContext2D, p: OpticalPiece) {
    const len = p.size || 65;

    // Green fluorescent dichroic element
    ctx.strokeStyle = '#39ff84';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#39ff84';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -len / 2);
    ctx.lineTo(0, len / 2);
    ctx.stroke();

    // Inner bright core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Subtle magenta back reflection line (dichroic filter visual cue)
    ctx.strokeStyle = 'rgba(255, 42, 141, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2.5, -len / 2 + 5);
    ctx.lineTo(-2.5, len / 2 - 5);
    ctx.stroke();
  }

  private renderLensPiece(ctx: CanvasRenderingContext2D, p: OpticalPiece) {
    const len = p.size || 70;
    const width = 16;

    // Biconvex lens profile
    ctx.beginPath();
    ctx.moveTo(0, -len / 2);
    ctx.quadraticCurveTo(width, 0, 0, len / 2);
    ctx.quadraticCurveTo(-width, 0, 0, -len / 2);
    ctx.closePath();

    // Translucent glass gradient
    const lensGrad = ctx.createLinearGradient(-width, 0, width, 0);
    lensGrad.addColorStop(0, 'rgba(160, 210, 255, 0.25)');
    lensGrad.addColorStop(0.5, 'rgba(230, 245, 255, 0.45)');
    lensGrad.addColorStop(1, 'rgba(160, 210, 255, 0.25)');
    ctx.fillStyle = lensGrad;
    ctx.fill();

    // Outer refractive glass edge
    ctx.strokeStyle = 'rgba(215, 240, 255, 0.9)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Specular center streak
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, width * 0.45, len * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}
