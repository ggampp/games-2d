export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.waterTime = 0;
    this.cloudOffset = 0;
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  render(state, dt = 0.016) {
    const { bridge, vehicle, particles, mode, activeMaterial, previewBeam, hoveredNode, hoveredBeam } = state;
    this.waterTime += dt;
    this.cloudOffset += dt * 5;

    this.clear();

    // 1. Environmental Background
    this.drawSky();
    this.drawDistantMountains();
    this.drawCliffs(bridge.leftCliff, bridge.rightCliff, bridge.waterY);
    this.drawRiver(bridge.waterY);

    // 2. Build Grid (in BUILD mode)
    if (mode === 'BUILD') {
      this.drawGrid();
    }

    // 3. Structural Bridge Anchors & Foundations
    this.drawAbutments(bridge);

    // 4. Bridge Beams
    this.drawBeams(bridge.beams, hoveredBeam, mode);

    // 5. Preview Beam (when dragging to create)
    if (previewBeam && mode === 'BUILD') {
      this.drawPreviewBeam(previewBeam, activeMaterial);
    }

    // 6. Bridge Joints (Nodes)
    this.drawNodes(bridge.nodes, hoveredNode, mode);

    // 7. Vehicle
    if (mode === 'TEST') {
      this.drawVehicle(vehicle);
    } else {
      this.drawVehicleGhost(vehicle);
    }

    // 8. Particles
    particles.draw(this.ctx);

    // 9. Overlay alerts / banners
    if (vehicle.hasFinished) {
      this.drawVictoryBanner();
    } else if (vehicle.hasFallen) {
      this.drawDefeatBanner();
    }
  }

  drawSky() {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.height * 0.7);
    grad.addColorStop(0, '#758c99'); // Overcast moody alpine sky like photo
    grad.addColorStop(0.45, '#9fb3be');
    grad.addColorStop(1, '#c9d8dc');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle cloud silhouettes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 300 + this.cloudOffset * 0.5) % (this.width + 200)) - 100;
      const cy = 60 + (i % 2) * 35;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 120, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawDistantMountains() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(92, 110, 118, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, 280);
    ctx.lineTo(150, 190);
    ctx.lineTo(340, 260);
    ctx.lineTo(520, 180);
    ctx.lineTo(680, 250);
    ctx.lineTo(840, 170);
    ctx.lineTo(this.width, 260);
    ctx.lineTo(this.width, 350);
    ctx.lineTo(0, 350);
    ctx.closePath();
    ctx.fill();
  }

  drawCliffs(leftCliff, rightCliff, waterY) {
    const ctx = this.ctx;

    // === LEFT CLIFF ===
    ctx.save();
    const leftGrad = ctx.createLinearGradient(0, 0, leftCliff.endX, this.height);
    leftGrad.addColorStop(0, '#5a4f47');
    leftGrad.addColorStop(0.5, '#423b36');
    leftGrad.addColorStop(1, '#2c2623');

    ctx.fillStyle = leftGrad;
    ctx.beginPath();
    ctx.moveTo(0, leftCliff.y);
    ctx.lineTo(leftCliff.endX, leftCliff.y);
    // Rocky crag profile
    ctx.lineTo(leftCliff.endX + 5, leftCliff.y + 70);
    ctx.lineTo(leftCliff.endX - 45, leftCliff.y + 150);
    ctx.lineTo(leftCliff.endX - 80, waterY + 40);
    ctx.lineTo(0, waterY + 40);
    ctx.closePath();
    ctx.fill();

    // Road surface on left cliff
    ctx.fillStyle = '#26292e';
    ctx.fillRect(0, leftCliff.y - 4, leftCliff.endX, 6);
    // Yellow road line
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(0, leftCliff.y - 1);
    ctx.lineTo(leftCliff.endX - 8, leftCliff.y - 1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Approach guardrail
    ctx.strokeStyle = '#8c959f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, leftCliff.y - 14);
    ctx.lineTo(leftCliff.endX - 5, leftCliff.y - 14);
    ctx.stroke();

    // Vegetated pine patches on rock
    this.drawPineTrees(ctx, 40, leftCliff.y - 2);
    this.drawPineTrees(ctx, 95, leftCliff.y - 2);
    this.drawRockFoliage(ctx, leftCliff.endX - 25, leftCliff.y + 90);
    this.drawRockFoliage(ctx, leftCliff.endX - 55, leftCliff.y + 160);
    ctx.restore();

    // === RIGHT CLIFF ===
    ctx.save();
    const rightGrad = ctx.createLinearGradient(rightCliff.startX, 0, this.width, this.height);
    rightGrad.addColorStop(0, '#5a4f47');
    rightGrad.addColorStop(0.5, '#423b36');
    rightGrad.addColorStop(1, '#2c2623');

    ctx.fillStyle = rightGrad;
    ctx.beginPath();
    ctx.moveTo(this.width, rightCliff.y);
    ctx.lineTo(rightCliff.startX, rightCliff.y);
    // Rocky crag profile
    ctx.lineTo(rightCliff.startX - 5, rightCliff.y + 70);
    ctx.lineTo(rightCliff.startX + 45, rightCliff.y + 150);
    ctx.lineTo(rightCliff.startX + 80, waterY + 40);
    ctx.lineTo(this.width, waterY + 40);
    ctx.closePath();
    ctx.fill();

    // Road surface on right cliff
    ctx.fillStyle = '#26292e';
    ctx.fillRect(rightCliff.startX, rightCliff.y - 4, this.width - rightCliff.startX, 6);
    // Yellow road line
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(rightCliff.startX + 8, rightCliff.y - 1);
    ctx.lineTo(this.width, rightCliff.y - 1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Approach guardrail
    ctx.strokeStyle = '#8c959f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rightCliff.startX + 5, rightCliff.y - 14);
    ctx.lineTo(this.width, rightCliff.y - 14);
    ctx.stroke();

    // Vegetated pine patches on right rock
    this.drawPineTrees(ctx, rightCliff.startX + 40, rightCliff.y - 2);
    this.drawPineTrees(ctx, rightCliff.startX + 110, rightCliff.y - 2);
    this.drawRockFoliage(ctx, rightCliff.startX + 25, rightCliff.y + 90);
    this.drawRockFoliage(ctx, rightCliff.startX + 55, rightCliff.y + 160);
    ctx.restore();
  }

  drawPineTrees(ctx, x, y) {
    ctx.fillStyle = '#2d4d36';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y - 28 + i * 8);
      ctx.lineTo(x - 9 + i * 2, y - 16 + i * 8);
      ctx.lineTo(x + 9 - i * 2, y - 16 + i * 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#4a3219';
    ctx.fillRect(x - 2, y - 4, 4, 6);
  }

  drawRockFoliage(ctx, x, y) {
    ctx.fillStyle = '#3c5a3d';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 2, 5, 0, Math.PI * 2);
    ctx.arc(x - 5, y + 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRiver(waterY) {
    const ctx = this.ctx;
    ctx.save();
    const riverGrad = ctx.createLinearGradient(0, waterY, 0, this.height);
    riverGrad.addColorStop(0, '#2d5c6b');
    riverGrad.addColorStop(0.3, '#1d424d');
    riverGrad.addColorStop(1, '#0e252c');

    ctx.fillStyle = riverGrad;
    ctx.fillRect(0, waterY, this.width, this.height - waterY);

    // River bed boulders / rocky riverbed from image
    ctx.fillStyle = '#5c544d';
    const boulders = [
      { x: 300, y: waterY + 20, r: 18 },
      { x: 340, y: waterY + 35, r: 24 },
      { x: 440, y: waterY + 28, r: 22 },
      { x: 580, y: waterY + 32, r: 20 },
      { x: 630, y: waterY + 22, r: 16 }
    ];
    for (const b of boulders) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r * 1.3, b.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Animated white water ripples and rapids
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    for (let j = 0; j < 6; j++) {
      const yPos = waterY + 12 + j * 10;
      ctx.beginPath();
      const waveOffset = Math.sin(this.waterTime * 3 + j) * 8;
      ctx.moveTo(220 + waveOffset, yPos);
      ctx.quadraticCurveTo(460, yPos + 4, 700 + waveOffset, yPos);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawAbutments(bridge) {
    const ctx = this.ctx;
    // Draw heavy stone/concrete foundation shoes on cliffs where anchors rest
    ctx.fillStyle = '#6e7782';
    ctx.strokeStyle = '#444c56';
    ctx.lineWidth = 2;

    for (const node of bridge.nodes) {
      if (node.isAnchor) {
        ctx.beginPath();
        ctx.rect(node.pos.x - 10, node.pos.y - 10, 20, 20);
        ctx.fill();
        ctx.stroke();

        // Steel bolt rivets in the plate
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(node.pos.x - 5, node.pos.y - 5, 2, 0, Math.PI * 2);
        ctx.arc(node.pos.x + 5, node.pos.y - 5, 2, 0, Math.PI * 2);
        ctx.arc(node.pos.x - 5, node.pos.y + 5, 2, 0, Math.PI * 2);
        ctx.arc(node.pos.x + 5, node.pos.y + 5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    const gridSize = 25;
    for (let x = 0; x < this.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 150);
      ctx.lineTo(x, 500);
      ctx.stroke();
    }
    for (let y = 150; y <= 500; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(120, y);
      ctx.lineTo(820, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBeams(beams, hoveredBeam, mode) {
    const ctx = this.ctx;

    // First pass: non-road structural beams
    for (const beam of beams) {
      if (beam.material.isRoad) continue;
      this.drawSingleBeam(beam, beam === hoveredBeam, mode);
    }

    // Second pass: Road deck on top
    for (const beam of beams) {
      if (!beam.material.isRoad) continue;
      this.drawSingleBeam(beam, beam === hoveredBeam, mode);
    }
  }

  drawSingleBeam(beam, isHovered, mode) {
    const ctx = this.ctx;
    const pA = beam.nodeA.pos;
    const pB = beam.nodeB.pos;

    if (beam.isBroken) {
      // Draw snapped broken beam stub lines dangling
      ctx.save();
      ctx.strokeStyle = '#424242';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo((pA.x * 2 + pB.x) / 3, (pA.y * 2 + pB.y) / 3 + 12);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pB.x, pB.y);
      ctx.lineTo((pB.x * 2 + pA.x) / 3, (pB.y * 2 + pA.y) / 3 + 12);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();

    // Determine beam color (normal or live stress color in TEST mode)
    let strokeColor = isHovered ? '#ffeb3b' : beam.material.color;
    if (mode === 'TEST') {
      strokeColor = beam.getStressColor();
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = beam.material.width;
    ctx.lineCap = 'round';

    if (beam.material.dash.length > 0) {
      ctx.setLineDash(beam.material.dash);
    }

    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();

    // Road specific styling: asphalt surface + lane dashes + railing
    if (beam.material.isRoad) {
      // Asphalt dark body
      ctx.strokeStyle = '#1e2126';
      ctx.lineWidth = 5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();

      // Guardrail posts on top of deck
      ctx.strokeStyle = 'rgba(200, 210, 225, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y - 7);
      ctx.lineTo(pB.x, pB.y - 7);
      ctx.stroke();
    }

    // Highlight beam if hovered in build mode
    if (isHovered && mode === 'BUILD') {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = beam.material.width + 4;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPreviewBeam(preview, material) {
    const ctx = this.ctx;
    const { startNode, currentPos, isValid, length } = preview;

    ctx.save();
    ctx.strokeStyle = isValid ? material.color : '#e74c3c';
    ctx.lineWidth = material.width;
    ctx.lineCap = 'round';
    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(startNode.pos.x, startNode.pos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();

    // Floating price & length badge
    const midX = (startNode.pos.x + currentPos.x) / 2;
    const midY = (startNode.pos.y + currentPos.y) / 2 - 14;
    const cost = Math.round(length * material.costPerUnit * 0.1);

    ctx.fillStyle = 'rgba(20, 25, 35, 0.85)';
    ctx.strokeStyle = isValid ? '#4ade80' : '#f87171';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(midX - 35, midY - 12, 70, 20, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${cost} (${Math.round(length)}m)`, midX, midY - 2);

    ctx.restore();
  }

  drawNodes(nodes, hoveredNode, mode) {
    const ctx = this.ctx;

    for (const node of nodes) {
      const isHovered = (node === hoveredNode);
      ctx.save();

      if (node.isAnchor) {
        // Red anchor joint
        ctx.fillStyle = isHovered ? '#ff7979' : '#e74c3c';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.arc(node.pos.x, node.pos.y, isHovered ? 8 : 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(node.pos.x, node.pos.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Dynamic bridge joint
        ctx.fillStyle = isHovered ? '#60a5fa' : '#3b82f6';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(node.pos.x, node.pos.y, isHovered ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(node.pos.x, node.pos.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isHovered && mode === 'BUILD') {
        // Magnetic snap ring
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.pos.x, node.pos.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawVehicle(vehicle) {
    const ctx = this.ctx;
    ctx.save();

    ctx.translate(vehicle.pos.x, vehicle.pos.y);
    ctx.rotate(vehicle.angle);

    const spec = vehicle.spec;
    const w = spec.chassisWidth;
    const h = spec.chassisHeight;

    // Body
    ctx.fillStyle = spec.color;
    ctx.strokeStyle = '#1a202c';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(-w / 2, -h + 4, w, h - 8, 4);
    ctx.fill();
    ctx.stroke();

    // Cabin / Windows
    ctx.fillStyle = spec.roofColor;
    ctx.beginPath();
    ctx.roundRect(-w * 0.25, -h - 6, w * 0.55, h * 0.6, [4, 4, 0, 0]);
    ctx.fill();
    ctx.stroke();

    // Glass
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(-w * 0.2, -h - 3, w * 0.45, h * 0.45);

    // Headlight
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(w / 2 - 3, -h * 0.4, 4, 6);

    ctx.restore();

    // Draw wheels in world coordinates
    const wheels = vehicle.getWheelPositions();
    this.drawWheel(ctx, wheels.rear.x, wheels.rear.y, spec.wheelRadius, vehicle.wheelRotation);
    this.drawWheel(ctx, wheels.front.x, wheels.front.y, spec.wheelRadius, vehicle.wheelRotation);
  }

  drawVehicleGhost(vehicle) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.4;
    this.drawVehicle(vehicle);
    ctx.restore();
  }

  drawWheel(ctx, x, y, r, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Rubber Tire
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rim
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Spokes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0);
    ctx.lineTo(r * 0.5, 0);
    ctx.moveTo(0, -r * 0.5);
    ctx.lineTo(0, r * 0.5);
    ctx.stroke();

    ctx.restore();
  }

  drawVictoryBanner() {
    const ctx = this.ctx;
    ctx.save();
    const cx = this.width / 2;
    const cy = 110;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - 200, cy - 40, 400, 80, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 PONTE APROVADA COM SUCESSO!', cx, cy - 6);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px sans-serif';
    ctx.fillText('O veículo atravessou o desfiladeiro em segurança!', cx, cy + 22);

    ctx.restore();
  }

  drawDefeatBanner() {
    const ctx = this.ctx;
    ctx.save();
    const cx = this.width / 2;
    const cy = 110;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - 200, cy - 40, 400, 80, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💥 COLAPSO ESTRUTURAL!', cx, cy - 6);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px sans-serif';
    ctx.fillText('A ponte cedeu sob a carga. Reforce a triangulação!', cx, cy + 22);

    ctx.restore();
  }
}
