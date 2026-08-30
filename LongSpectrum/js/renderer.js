/**
 * The Long Spectrum - Canvas 2D Renderer
 * Renders volumetric light beams, chromatic dispersion, realistic glass prisms,
 * specular mirrors, glowing target beacons, dust particles, and UI gizmos.
 */

class GameRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.particles = [];
        this.victoryParticles = [];
        this.targetEffects = [];
        this.time = 0;
        this.optics = new OpticsEngine();

        this.initDustParticles(100);
    }

    initDustParticles(count) {
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * 1000,
                y: Math.random() * 1000,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.2 - 0.1,
                size: Math.random() * 1.6 + 0.6,
                alpha: Math.random() * 0.5 + 0.2,
                flickerSpeed: Math.random() * 2 + 1
            });
        }
    }

    spawnVictoryParticles(targets) {
        this.victoryParticles = [];
        for (const target of targets) {
            const colors = {
                blue: ['#60a5fa', '#3b82f6', '#93c5fd', '#ffffff'],
                green: ['#4ade80', '#22c55e', '#86efac', '#ffffff'],
                orange: ['#fb923c', '#f97316', '#fdba74', '#ffffff'],
                red: ['#f87171', '#ef4444', '#fca5a5', '#ffffff'],
                white: ['#ffffff', '#e2e8f0', '#94a3b8']
            };
            const pal = colors[target.color] || colors.white;

            for (let i = 0; i < 90; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 7 + 2;
                this.victoryParticles.push({
                    x: target.x,
                    y: target.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 1.5,
                    size: Math.random() * 3.5 + 1.5,
                    color: pal[Math.floor(Math.random() * pal.length)],
                    life: 1.0,
                    decay: Math.random() * 0.015 + 0.008,
                    gravity: 0.12
                });
            }
        }
    }

    // Render brick texture for walls & borders
    drawBrickWall(x, y, w, h) {
        const ctx = this.ctx;
        ctx.save();

        // Base mortar color
        ctx.fillStyle = '#1c1615';
        ctx.fillRect(x, y, w, h);

        const brickW = 26;
        const brickH = 12;
        const mortar = 2;

        const cols = Math.ceil(w / (brickW + mortar)) + 1;
        const rows = Math.ceil(h / (brickH + mortar)) + 1;

        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        for (let r = 0; r < rows; r++) {
            const rowY = y + r * (brickH + mortar);
            const offsetX = (r % 2 === 0) ? 0 : -(brickW / 2);

            for (let c = 0; c < cols; c++) {
                const bx = x + offsetX + c * (brickW + mortar);
                const by = rowY;

                // Subtle brick color variation (terracotta / aged red-brown)
                const hash = Math.sin(bx * 12.9898 + by * 78.233) * 43758.5453;
                const tint = (hash - Math.floor(hash));
                const redVal = Math.floor(105 + tint * 35);
                const greenVal = Math.floor(52 + tint * 20);
                const blueVal = Math.floor(48 + tint * 18);

                ctx.fillStyle = `rgb(${redVal}, ${greenVal}, ${blueVal})`;
                ctx.fillRect(bx, by, brickW, brickH);

                // Brick highlight & bevel
                ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
                ctx.fillRect(bx, by, brickW, 1.5);
                ctx.fillRect(bx, by, 1.5, brickH);

                ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
                ctx.fillRect(bx, by + brickH - 1.5, brickW, 1.5);
                ctx.fillRect(bx + brickW - 1.5, by, 1.5, brickH);
            }
        }

        // Inner shadow around wall edges for 3D depth
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.strokeRect(x, y, w, h);

        ctx.restore();
    }

    // Render Light Emitter Housing
    drawEmitter(emitter) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(emitter.x, emitter.y);
        ctx.rotate(emitter.rotation);

        // Ambient projector glow behind housing
        const glowGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 75);
        glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        glowGrad.addColorStop(0.5, 'rgba(200, 225, 255, 0.08)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 75, 0, Math.PI * 2);
        ctx.fill();

        // Projector metallic base body
        ctx.fillStyle = '#22252a';
        ctx.fillRect(-22, -18, 22, 36);

        // Bevel highlight
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(-22, -18, 22, 36);

        // Lens aperture rim
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, -14, 6, 28);

        // Blinding white emitting slit
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 18;
        ctx.fillRect(4, -13, 4, 26);

        ctx.restore();
    }

    // Render Mirrors
    drawMirror(mirror, isSelected = false, isHovered = false) {
        const ctx = this.ctx;
        const length = mirror.length || 85;
        const half = length / 2;

        ctx.save();
        ctx.translate(mirror.x, mirror.y);
        ctx.rotate(mirror.rotation);

        // Selection / Hover aura
        if (isSelected || isHovered) {
            ctx.strokeStyle = isSelected ? 'rgba(96, 165, 250, 0.7)' : 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 14;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-half, 0);
            ctx.lineTo(half, 0);
            ctx.stroke();
        }

        // Mirror back chassis
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-half - 3, -4, length + 6, 8);
        ctx.strokeRect(-half - 3, -4, length + 6, 8);

        // Specular chrome reflective surface
        const grad = ctx.createLinearGradient(-half, 0, half, 0);
        grad.addColorStop(0, '#94a3b8');
        grad.addColorStop(0.3, '#f8fafc');
        grad.addColorStop(0.7, '#cbd5e1');
        grad.addColorStop(1, '#94a3b8');

        ctx.fillStyle = grad;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.fillRect(-half, -2, length, 4);

        // Mirror center pivot indicator
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Render Glass Prisms
    drawPrism(prism, isSelected = false, isHovered = false) {
        const ctx = this.ctx;
        const size = prism.size || 76;
        const vertices = this.optics.getPrismVertices(new Vector2(0, 0), size, 0);

        ctx.save();
        ctx.translate(prism.x, prism.y);
        ctx.rotate(prism.rotation);

        // Hover/Selection glow
        if (isSelected || isHovered) {
            ctx.strokeStyle = isSelected ? 'rgba(96, 165, 250, 0.6)' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 10;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            ctx.lineTo(vertices[1].x, vertices[1].y);
            ctx.lineTo(vertices[2].x, vertices[2].y);
            ctx.closePath();
            ctx.stroke();
        }

        // Frosted Glass Body
        const glassGrad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        glassGrad.addColorStop(0, 'rgba(230, 245, 255, 0.45)');
        glassGrad.addColorStop(0.5, 'rgba(180, 220, 250, 0.25)');
        glassGrad.addColorStop(1, 'rgba(140, 190, 230, 0.35)');

        ctx.fillStyle = glassGrad;
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        ctx.lineTo(vertices[1].x, vertices[1].y);
        ctx.lineTo(vertices[2].x, vertices[2].y);
        ctx.closePath();
        ctx.fill();

        // Inner refraction glass facet lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        ctx.lineTo(0, 5);
        ctx.lineTo(vertices[1].x, vertices[1].y);
        ctx.stroke();

        // Polished crystal outline
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#93c5fd';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        ctx.lineTo(vertices[1].x, vertices[1].y);
        ctx.lineTo(vertices[2].x, vertices[2].y);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
    }

    // Render Colored Target Beacons
    drawTarget(targetData) {
        const { target, active, matchScore } = targetData;
        const ctx = this.ctx;
        const x = target.x;
        const y = target.y;
        const radius = target.radius || 28;

        const colorMap = {
            blue: { stroke: '#3b82f6', fill: '#1e3a8a', glow: '#60a5fa', flag: '#3b82f6' },
            green: { stroke: '#22c55e', fill: '#14532d', glow: '#4ade80', flag: '#22c55e' },
            orange: { stroke: '#f97316', fill: '#7c2d12', glow: '#fb923c', flag: '#f97316' },
            red: { stroke: '#ef4444', fill: '#7f1d1d', glow: '#f87171', flag: '#ef4444' },
            white: { stroke: '#f8fafc', fill: '#334155', glow: '#ffffff', flag: '#f8fafc' }
        };

        const theme = colorMap[target.color] || colorMap.white;

        ctx.save();

        // Active State Radiant Effects (Pulsing wave rings, lens flare)
        if (active) {
            const pulse = (Math.sin(this.time * 6) + 1) * 0.5;

            // Expanding aura wave
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const auraGrad = ctx.createRadialGradient(x, y, 5, x, y, radius * 2.8);
            auraGrad.addColorStop(0, theme.glow);
            auraGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
            auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = auraGrad;
            ctx.beginPath();
            ctx.arc(x, y, radius * 2.8 + pulse * 6, 0, Math.PI * 2);
            ctx.fill();

            // Concentric shockwave ring
            const waveR = radius * (1.2 + ((this.time * 1.5) % 1) * 1.4);
            const waveAlpha = 1.0 - ((this.time * 1.5) % 1);
            ctx.strokeStyle = theme.glow;
            ctx.lineWidth = 3;
            ctx.globalAlpha = waveAlpha;
            ctx.beginPath();
            ctx.arc(x, y, waveR, 0, Math.PI * 2);
            ctx.stroke();

            // Rotating radiant lens flare spikes
            ctx.globalAlpha = 0.85;
            ctx.translate(x, y);
            ctx.rotate(this.time * 1.2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.8;
            for (let i = 0; i < 8; i++) {
                const spikeLen = (i % 2 === 0) ? radius * 2.2 : radius * 1.4;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, spikeLen);
                ctx.stroke();
                ctx.rotate(Math.PI / 4);
            }
            ctx.restore();
        }

        // Base Ring (Pedestal)
        ctx.save();
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = active ? 24 : 10;
        ctx.strokeStyle = active ? '#ffffff' : theme.stroke;
        ctx.lineWidth = active ? 4.5 : 3;

        ctx.fillStyle = active ? theme.glow : 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner glowing core
        ctx.fillStyle = active ? '#ffffff' : theme.fill;
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Flag Pole and Pennant
        ctx.save();
        ctx.translate(x, y);

        // Flagpole
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -radius * 1.7);
        ctx.stroke();

        // Flag Finial
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(0, -radius * 1.7, 3, 0, Math.PI * 2);
        ctx.fill();

        // Waving Flag Pennant
        const flagWave = Math.sin(this.time * 4 + x * 0.05) * 3;
        ctx.fillStyle = active ? '#ffffff' : theme.flag;
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = active ? 16 : 6;

        ctx.beginPath();
        ctx.moveTo(0, -radius * 1.7);
        ctx.quadraticCurveTo(radius * 0.8, -radius * 1.7 + flagWave, radius * 1.4, -radius * 1.35);
        ctx.quadraticCurveTo(radius * 0.6, -radius * 1.05 + flagWave, 0, -radius * 1.0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        ctx.restore();
    }

    // Render Interactive Rotation Gizmo on Selected Element
    drawRotationGizmo(element) {
        if (!element) return;
        const ctx = this.ctx;
        const x = element.x;
        const y = element.y;
        const rot = element.rotation;
        const radius = 62; // Gizmo circle radius

        ctx.save();
        ctx.translate(x, y);

        // Subtle guide circle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rotation Handle Knob (at angle)
        const handleX = Math.cos(rot) * radius;
        const handleY = Math.sin(rot) * radius;

        // Line to handle knob
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(handleX, handleY);
        ctx.stroke();

        // White Knob
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(handleX, handleY, 6.5, 0, Math.PI * 2);
        ctx.fill();

        // Angle Text Readout (in degrees)
        let deg = (rot * 180 / Math.PI) % 360;
        if (deg < 0) deg += 360;
        const degText = `${deg.toFixed(1)}°`;

        ctx.font = '12px "Space Grotesk", "Fira Code", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(degText, handleX + 10, handleY - 8);

        ctx.restore();
    }

    // Render the Light Beams with Volumetric Texture and Dispersion
    drawLightBeams(segments, secondaryBeams) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // 1. Draw secondary faint Fresnel beams first
        if (secondaryBeams && secondaryBeams.length > 0) {
            for (const beam of secondaryBeams) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(beam.from.x, beam.from.y);
                ctx.lineTo(beam.to.x, beam.to.y);
                ctx.stroke();
            }
        }

        // 2. Render all ray segments
        for (const seg of segments) {
            const { from, to, intensity, wavelength, isWhite, insideGlass } = seg;

            if (isWhite) {
                // Coherent White Light Beam Component
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * intensity})`;
                ctx.lineWidth = insideGlass ? 2.0 : 3.2;
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();

                // Soft outer chromatic beam halo
                ctx.strokeStyle = `rgba(240, 248, 255, ${0.05 * intensity})`;
                ctx.lineWidth = 6.0;
                ctx.stroke();
            } else {
                // Dispersed Chromatic Spectrum Ray
                const rgb = wavelengthToRGB(wavelength);
                const alpha = insideGlass ? 0.35 : 0.45;
                ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * intensity})`;
                ctx.lineWidth = insideGlass ? 2.5 : 3.8;

                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();

                // Subtle spectral glow
                ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.15 * intensity})`;
                ctx.lineWidth = 8.0;
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    // Animate & Render Floating Ambient Dust Particles in Light
    updateAndDrawDustParticles(segments) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;

            // Wrap around board boundaries (inner area ~50 to 950)
            if (p.x < 60) p.x = 940;
            if (p.x > 940) p.x = 60;
            if (p.y < 60) p.y = 940;
            if (p.y > 940) p.y = 60;

            // Check if particle is illuminated by any light ray
            let illuminated = false;
            let pColor = 'rgba(255, 255, 255, 0.15)';

            // Fast proximity check against a subset of segments
            const pVec = new Vector2(p.x, p.y);
            for (let i = 0; i < segments.length; i += 3) {
                const seg = segments[i];
                const d = distToSegment(pVec, seg.from, seg.to);
                if (d < 18) {
                    illuminated = true;
                    if (!seg.isWhite) {
                        const rgb = wavelengthToRGB(seg.wavelength);
                        pColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.65})`;
                    } else {
                        pColor = 'rgba(255, 255, 255, 0.75)';
                    }
                    break;
                }
            }

            if (illuminated) {
                const flicker = Math.sin(this.time * p.flickerSpeed + p.x) * 0.3 + 0.7;
                ctx.fillStyle = pColor;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * flicker, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    // Render celebration victory sparks
    updateAndDrawVictoryParticles() {
        if (this.victoryParticles.length === 0) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        for (let i = this.victoryParticles.length - 1; i >= 0; i--) {
            const p = this.victoryParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.life -= p.decay;

            if (p.life <= 0) {
                this.victoryParticles.splice(i, 1);
                continue;
            }

            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // Master render loop
    render(gameState, deltaTime) {
        this.time += deltaTime;
        const ctx = this.ctx;
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;

        ctx.save();
        ctx.scale(this.dpr, this.dpr);

        // 1. Dark Room Void Background
        ctx.fillStyle = '#070709';
        ctx.fillRect(0, 0, width, height);

        // 2. Outer Brick Framing
        const borderThickness = 24;
        this.drawBrickWall(0, 0, 1000, borderThickness); // Top
        this.drawBrickWall(0, 1000 - borderThickness, 1000, borderThickness); // Bottom
        this.drawBrickWall(0, 0, borderThickness, 1000); // Left
        this.drawBrickWall(1000 - borderThickness, 0, borderThickness, 1000); // Right

        // 3. Inner Brick Walls / Obstacles
        if (gameState.walls) {
            for (const wall of gameState.walls) {
                this.drawBrickWall(wall.x, wall.y, wall.width, wall.height);
            }
        }

        // 4. Optics Simulation
        const simResult = this.optics.simulate(
            gameState.emitters || [],
            gameState.placedMirrors || [],
            gameState.placedPrisms || [],
            gameState.walls || [],
            gameState.targets || []
        );

        // 5. Draw Light Beams
        this.drawLightBeams(simResult.segments, simResult.secondaryBeams);

        // 6. Draw Dust Particles
        this.updateAndDrawDustParticles(simResult.segments);

        // 7. Draw Emitters
        if (gameState.emitters) {
            for (const emitter of gameState.emitters) {
                this.drawEmitter(emitter);
            }
        }

        // 8. Draw Targets
        simResult.targetResults.forEach(targetData => {
            this.drawTarget(targetData);
        });

        // 9. Draw Mirrors
        if (gameState.placedMirrors) {
            for (const mirror of gameState.placedMirrors) {
                const isSelected = gameState.selectedElement === mirror;
                const isHovered = gameState.hoveredElement === mirror;
                this.drawMirror(mirror, isSelected, isHovered);
            }
        }

        // 10. Draw Prisms
        if (gameState.placedPrisms) {
            for (const prism of gameState.placedPrisms) {
                const isSelected = gameState.selectedElement === prism;
                const isHovered = gameState.hoveredElement === prism;
                this.drawPrism(prism, isSelected, isHovered);
            }
        }

        // 11. Draw Rotation Gizmo on Selected Element
        if (gameState.selectedElement) {
            this.drawRotationGizmo(gameState.selectedElement);
        }

        // 12. Victory Confetti / Fireworks
        this.updateAndDrawVictoryParticles();

        ctx.restore();

        return simResult;
    }
}

// Distance from point to line segment helper
function distToSegment(p, v, w) {
    const l2 = v.distanceTo(w) * v.distanceTo(w);
    if (l2 === 0) return p.distanceTo(v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = new Vector2(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y));
    return p.distanceTo(projection);
}

window.GameRenderer = GameRenderer;
