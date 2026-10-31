import { OpticalPiece, Point } from '../engine/types.ts';

export class GizmoRenderer {
  public renderProtractor(
    ctx: CanvasRenderingContext2D,
    piece: OpticalPiece,
    _mousePos?: Point
  ) {
    const gizmoRadius = 52;
    ctx.save();
    ctx.translate(piece.x, piece.y);

    // 1. Outer Orange Protractor Ring
    ctx.strokeStyle = '#d49b38';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, gizmoRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Degree ticks (every 15° and 90°)
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 90 === 0;
      const isSemi = deg % 45 === 0;
      const innerR = isMajor ? gizmoRadius - 9 : isSemi ? gizmoRadius - 6 : gizmoRadius - 4;

      ctx.strokeStyle = isMajor ? '#ffb834' : '#997328';
      ctx.lineWidth = isMajor ? 1.8 : 1.0;

      ctx.beginPath();
      ctx.moveTo(Math.cos(rad) * innerR, Math.sin(rad) * innerR);
      ctx.lineTo(Math.cos(rad) * gizmoRadius, Math.sin(rad) * gizmoRadius);
      ctx.stroke();
    }

    // 3. Current Angle Indicator Line & Degree Readout
    let degNorm = (piece.angle * 180 / Math.PI) % 360;
    if (degNorm < 0) degNorm += 360;

    // Angle text on top of the protractor
    const degText = `${degNorm.toFixed(1)}°`;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffc04d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(degText, 0, -gizmoRadius - 6);

    // Indicator tick line to top
    ctx.strokeStyle = '#ffb834';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -gizmoRadius + 4);
    ctx.lineTo(0, -gizmoRadius - 4);
    ctx.stroke();

    // 4. Rotation Handle (circle on the protractor ring at piece.angle)
    const handleX = Math.cos(piece.angle) * gizmoRadius;
    const handleY = Math.sin(piece.angle) * gizmoRadius;

    // Line from center to handle
    ctx.strokeStyle = 'rgba(255, 184, 52, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(handleX, handleY);
    ctx.stroke();

    // Outer handle circle
    ctx.fillStyle = '#ffb834';
    ctx.strokeStyle = '#181a22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handleX, handleY, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner bright dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(handleX, handleY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Check if a point hits the rotation handle
  public isOverHandle(piece: OpticalPiece, clickX: number, clickY: number): boolean {
    const gizmoRadius = 52;
    const handleX = piece.x + Math.cos(piece.angle) * gizmoRadius;
    const handleY = piece.y + Math.sin(piece.angle) * gizmoRadius;
    const d = Math.hypot(clickX - handleX, clickY - handleY);
    return d <= 12;
  }

  // Check if a point hits the protractor ring
  public isOverProtractor(piece: OpticalPiece, clickX: number, clickY: number): boolean {
    const gizmoRadius = 52;
    const d = Math.hypot(clickX - piece.x, clickY - piece.y);
    return Math.abs(d - gizmoRadius) <= 10;
  }
}
