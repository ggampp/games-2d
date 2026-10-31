import {
  Point,
  Vector,
  OpticalPiece,
  LightEmitter,
  Target,
  BlackHole,
  WallObstacle,
  RaySegment
} from './types.ts';

// Helper math functions
export function dist(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function normalize(v: Vector): Vector {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function dot(v1: Vector, v2: Vector): number {
  return v1.x * v2.x + v1.y * v2.y;
}

export function cross(v1: Vector, v2: Vector): number {
  return v1.x * v2.y - v1.y * v2.x;
}

// Convert wavelength (380 - 750 nm) to RGB color
export function wavelengthToRGB(wl: number, alpha: number = 1): string {
  let r = 0, g = 0, b = 0;
  if (wl >= 380 && wl < 440) {
    r = -(wl - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (wl >= 440 && wl < 490) {
    r = 0;
    g = (wl - 440) / (490 - 440);
    b = 1;
  } else if (wl >= 490 && wl < 510) {
    r = 0;
    g = 1;
    b = -(wl - 510) / (510 - 490);
  } else if (wl >= 510 && wl < 580) {
    r = (wl - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (wl >= 580 && wl < 645) {
    r = 1;
    g = -(wl - 645) / (645 - 580);
    b = 0;
  } else if (wl >= 645 && wl <= 750) {
    r = 1;
    g = 0;
    b = 0;
  }

  // Intensity falloff near edges of vision
  let factor = 1.0;
  if (wl >= 380 && wl < 420) {
    factor = 0.3 + 0.7 * (wl - 380) / (420 - 380);
  } else if (wl >= 700 && wl <= 750) {
    factor = 0.3 + 0.7 * (750 - wl) / (750 - 700);
  }

  r = Math.round(r * factor * 255);
  g = Math.round(g * factor * 255);
  b = Math.round(b * factor * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Line intersection
function lineIntersection(
  p1: Point, p2: Point,
  p3: Point, p4: Point
): { point: Point; t: number; u: number } | null {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 1e-6) return null;

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p3.x - p3.x)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      point: {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y)
      },
      t,
      u
    };
  }
  return null;
}

// Get triangular vertices of a prism
export function getPrismVertices(piece: OpticalPiece): Point[] {
  const r = piece.size || 50;
  const angle = piece.angle;
  const pts: Point[] = [];
  for (let i = 0; i < 3; i++) {
    const a = angle + (i * 2 * Math.PI) / 3 - Math.PI / 2;
    pts.push({
      x: piece.x + r * Math.cos(a),
      y: piece.y + r * Math.sin(a)
    });
  }
  return pts;
}

// Get line segment endpoints for mirror, green splitter or lens
export function getSegmentEndpoints(piece: OpticalPiece): { p1: Point; p2: Point; normal: Vector } {
  const halfLen = (piece.size || 70) / 2;
  const cos = Math.cos(piece.angle);
  const sin = Math.sin(piece.angle);

  // Line lies along perpendicular to piece.angle
  const perpCos = -sin;
  const perpSin = cos;

  const p1 = {
    x: piece.x - perpCos * halfLen,
    y: piece.y - perpSin * halfLen
  };
  const p2 = {
    x: piece.x + perpCos * halfLen,
    y: piece.y + perpSin * halfLen
  };

  // Normal points in piece.angle direction
  const normal = { x: cos, y: sin };
  return { p1, p2, normal };
}

// Point in polygon test for prism interior
export function pointInTriangle(pt: Point, v: Point[]): boolean {
  function sign(p1: Point, p2: Point, p3: Point) {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  }
  const d1 = sign(pt, v[0], v[1]);
  const d2 = sign(pt, v[1], v[2]);
  const d3 = sign(pt, v[2], v[0]);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

// Ray structure for internal tracing
interface ActiveRay {
  pos: Point;
  dir: Vector;
  intensity: number;
  wavelength: number | null; // null = white
  path: Point[];
  bounces: number;
  insidePrismId: string | null;
  history: Point[];
}

export class LightPhysicsEngine {
  private arenaBounds = { minX: 30, minY: 30, maxX: 870, maxY: 870 };

  public simulate(
    emitter: LightEmitter,
    pieces: OpticalPiece[],
    blackHoles: BlackHole[],
    walls: WallObstacle[],
    targets: Target[]
  ): { rays: RaySegment[]; litTargets: Set<string> } {
    const outputRays: RaySegment[] = [];
    const litTargets = new Set<string>();

    // Reset target detection
    targets.forEach(t => (t.isLit = false));

    // Spawn volumetric bundle of primary white rays
    const rayCount = 18; // Dense bundle for volumetric appearance
    const spreadHalf = emitter.beamWidth / 2;
    const emitterDir: Vector = {
      x: Math.cos(emitter.angle),
      y: Math.sin(emitter.angle)
    };
    const emitterPerp: Vector = {
      x: -emitterDir.y,
      y: emitterDir.x
    };

    const activeRays: ActiveRay[] = [];

    for (let i = 0; i < rayCount; i++) {
      const offset = -spreadHalf + (emitter.beamWidth * i) / (rayCount - 1);
      // Gaussian intensity profile across beam
      const normalizedOffset = (offset / spreadHalf);
      const intensity = Math.exp(-normalizedOffset * normalizedOffset * 2.2);

      const startPos: Point = {
        x: emitter.x + emitterPerp.x * offset,
        y: emitter.y + emitterPerp.y * offset
      };

      activeRays.push({
        pos: { ...startPos },
        dir: { ...emitterDir },
        intensity,
        wavelength: null, // White beam
        path: [startPos],
        bounces: 0,
        insidePrismId: null,
        history: [startPos]
      });
    }

    const maxSteps = 400;
    const stepSize = 4.0; // Raymarching precision in pixels

    // Process rays in simulation queue
    while (activeRays.length > 0) {
      const ray = activeRays.shift()!;
      if (ray.intensity < 0.05 || ray.bounces > 12) {
        this.flushRayToOutput(ray, outputRays);
        continue;
      }

      let currentPos = { ...ray.pos };
      let currentDir = { ...ray.dir };
      let isTerminated = false;

      for (let s = 0; s < maxSteps; s++) {
        // Apply Gravitational Lensing if near Black Hole
        for (const bh of blackHoles) {
          const dx = bh.x - currentPos.x;
          const dy = bh.y - currentPos.y;
          const rSq = dx * dx + dy * dy;
          const r = Math.sqrt(rSq);

          // Event horizon absorption
          if (r < bh.eventHorizonRadius) {
            isTerminated = true;
            break;
          }

          // Gravitational deflection
          if (r < bh.accretionRadius * 2.2 && r > 5) {
            const accel = (bh.mass * 1400) / (rSq + 400);
            const gravForceX = (dx / r) * accel * (stepSize / 60);
            const gravForceY = (dy / r) * accel * (stepSize / 60);
            currentDir.x += gravForceX;
            currentDir.y += gravForceY;
            currentDir = normalize(currentDir);
          }
        }

        if (isTerminated) break;

        // Next candidate position
        const nextPos: Point = {
          x: currentPos.x + currentDir.x * stepSize,
          y: currentPos.y + currentDir.y * stepSize
        };

        // Check arena boundaries
        if (
          nextPos.x < this.arenaBounds.minX ||
          nextPos.x > this.arenaBounds.maxX ||
          nextPos.y < this.arenaBounds.minY ||
          nextPos.y > this.arenaBounds.maxY
        ) {
          ray.path.push(nextPos);
          isTerminated = true;
          break;
        }

        // Check Wall Obstacles
        let wallHit = false;
        for (const wall of walls) {
          if (
            nextPos.x >= wall.x &&
            nextPos.x <= wall.x + wall.width &&
            nextPos.y >= wall.y &&
            nextPos.y <= wall.y + wall.height
          ) {
            ray.path.push(nextPos);
            wallHit = true;
            break;
          }
        }
        if (wallHit) {
          isTerminated = true;
          break;
        }

        // Check Target illumination
        for (const target of targets) {
          if (dist(nextPos, target) < target.radius * 0.95) {
            // Verify correct color match
            const matches = this.checkColorMatch(ray.wavelength, target.colorType);
            if (matches) {
              target.isLit = true;
              litTargets.add(target.id);
            }
          }
        }

        // Check Optical Pieces (Prism, Mirror, Green Splitter, Lens)
        let pieceInteracted = false;

        for (const piece of pieces) {
          if (piece.type === 'prism') {
            const verts = getPrismVertices(piece);
            // Check intersection with all 3 faces of the prism
            for (let e = 0; e < 3; e++) {
              const v1 = verts[e];
              const v2 = verts[(e + 1) % 3];
              const hit = lineIntersection(currentPos, nextPos, v1, v2);

              if (hit && ray.insidePrismId !== piece.id) {
                ray.path.push(hit.point);
                this.flushRayToOutput(ray, outputRays);

                const edgeVec: Vector = { x: v2.x - v1.x, y: v2.y - v1.y };
                let normal: Vector = normalize({ x: -edgeVec.y, y: edgeVec.x });
                if (dot(currentDir, normal) > 0) {
                  normal = { x: -normal.x, y: -normal.y };
                }

                // 1) Weak specular reflection off front face (white beam to top right)
                const reflDir: Vector = {
                  x: currentDir.x - 2 * dot(currentDir, normal) * normal.x,
                  y: currentDir.y - 2 * dot(currentDir, normal) * normal.y
                };
                activeRays.push({
                  pos: {
                    x: hit.point.x + reflDir.x * 4,
                    y: hit.point.y + reflDir.y * 4
                  },
                  dir: normalize(reflDir),
                  intensity: ray.intensity * 0.45,
                  wavelength: ray.wavelength,
                  path: [hit.point],
                  bounces: ray.bounces + 1,
                  insidePrismId: piece.id,
                  history: [...ray.history, hit.point]
                });

                // 2) Disperse into radiant rainbow fan from the prism!
                // Primary spectrum fan towards the right
                const wavelengths = [410, 440, 470, 500, 530, 560, 590, 620, 660, 700];
                const baseAngle = Math.atan2(currentDir.y, currentDir.x);
                const prismRotationOffset = (piece.angle - 4.98); // Relative to default 285°
                
                // Primary refracted fan passing above the black hole accretion disk
                wavelengths.forEach((wl) => {
                  const normalizedWl = (wl - 400) / 300; // 0 (violet) to 1 (red)
                  const fanSpread = 0.42;
                  const dispersionAngle = baseAngle - 0.38 + (1.0 - normalizedWl) * fanSpread + prismRotationOffset * 0.85;

                  const fanDir: Vector = {
                    x: Math.cos(dispersionAngle),
                    y: Math.sin(dispersionAngle)
                  };

                  const startX = hit.point.x + fanDir.x * 5;
                  const startY = hit.point.y + fanDir.y * 5;

                  activeRays.push({
                    pos: { x: startX, y: startY },
                    dir: normalize(fanDir),
                    intensity: ray.intensity * 0.88,
                    wavelength: wl,
                    path: [hit.point, { x: startX, y: startY }],
                    bounces: ray.bounces + 1,
                    insidePrismId: piece.id,
                    history: [...ray.history, hit.point]
                  });
                });

                // Secondary downward fan (internal reflection exiting bottom face towards black hole)
                [420, 480, 540, 600, 660].forEach((wl) => {
                  const normalizedWl = (wl - 400) / 300;
                  const downAngle = Math.PI * 0.46 + (1.0 - normalizedWl) * 0.22 + prismRotationOffset * 0.85;
                  const downDir: Vector = {
                    x: Math.cos(downAngle),
                    y: Math.sin(downAngle)
                  };

                  const startX = hit.point.x + downDir.x * 5;
                  const startY = hit.point.y + downDir.y * 5;

                  activeRays.push({
                    pos: { x: startX, y: startY },
                    dir: normalize(downDir),
                    intensity: ray.intensity * 0.75,
                    wavelength: wl,
                    path: [hit.point, { x: startX, y: startY }],
                    bounces: ray.bounces + 1,
                    insidePrismId: piece.id,
                    history: [...ray.history, hit.point]
                  });
                });

                pieceInteracted = true;
                isTerminated = true;
                break;
              }
            }
          } else if (piece.type === 'mirror') {
            const { p1, p2, normal } = getSegmentEndpoints(piece);
            const hit = lineIntersection(currentPos, nextPos, p1, p2);

            if (hit) {
              ray.path.push(hit.point);
              this.flushRayToOutput(ray, outputRays);

              // Specular reflection
              let norm = normal;
              if (dot(currentDir, norm) > 0) {
                norm = { x: -norm.x, y: -norm.y };
              }
              const reflDir: Vector = {
                x: currentDir.x - 2 * dot(currentDir, norm) * norm.x,
                y: currentDir.y - 2 * dot(currentDir, norm) * norm.y
              };

              activeRays.push({
                pos: {
                  x: hit.point.x + reflDir.x * 2,
                  y: hit.point.y + reflDir.y * 2
                },
                dir: normalize(reflDir),
                intensity: ray.intensity * 0.95,
                wavelength: ray.wavelength,
                path: [hit.point],
                bounces: ray.bounces + 1,
                insidePrismId: null,
                history: [...ray.history, hit.point]
              });

              pieceInteracted = true;
              isTerminated = true;
              break;
            }
          } else if (piece.type === 'green') {
            // Dichroic green splitter: reflects green (500-565nm), transmits others
            const { p1, p2, normal } = getSegmentEndpoints(piece);
            const hit = lineIntersection(currentPos, nextPos, p1, p2);

            if (hit) {
              ray.path.push(hit.point);
              this.flushRayToOutput(ray, outputRays);

              let norm = normal;
              if (dot(currentDir, norm) > 0) {
                norm = { x: -norm.x, y: -norm.y };
              }

              const isGreenComponent =
                ray.wavelength === null ||
                (ray.wavelength >= 495 && ray.wavelength <= 570);

              if (isGreenComponent) {
                // Reflect green
                const reflDir: Vector = {
                  x: currentDir.x - 2 * dot(currentDir, norm) * norm.x,
                  y: currentDir.y - 2 * dot(currentDir, norm) * norm.y
                };
                activeRays.push({
                  pos: {
                    x: hit.point.x + reflDir.x * 2,
                    y: hit.point.y + reflDir.y * 2
                  },
                  dir: normalize(reflDir),
                  intensity: ray.intensity * 0.92,
                  wavelength: 535, // Green component
                  path: [hit.point],
                  bounces: ray.bounces + 1,
                  insidePrismId: null,
                  history: [...ray.history, hit.point]
                });
              }

              // Transmit non-green components
              if (ray.wavelength === null || ray.wavelength < 495 || ray.wavelength > 570) {
                activeRays.push({
                  pos: {
                    x: hit.point.x + currentDir.x * 2,
                    y: hit.point.y + currentDir.y * 2
                  },
                  dir: currentDir,
                  intensity: ray.intensity * 0.88,
                  wavelength: ray.wavelength,
                  path: [hit.point],
                  bounces: ray.bounces + 1,
                  insidePrismId: null,
                  history: [...ray.history, hit.point]
                });
              }

              pieceInteracted = true;
              isTerminated = true;
              break;
            }
          } else if (piece.type === 'lens') {
            // Convex lens: focal bending
            const { p1, p2, normal } = getSegmentEndpoints(piece);
            const hit = lineIntersection(currentPos, nextPos, p1, p2);

            if (hit) {
              ray.path.push(hit.point);
              this.flushRayToOutput(ray, outputRays);

              // Distance from lens center along perpendicular
              const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
              const perpDist = (hit.point.x - midPoint.x) * normal.y - (hit.point.y - midPoint.y) * normal.x;

              // Angle deviation proportional to distance from center (thin lens formula)
              const focalLen = 140; // focal length in px
              const deltaAngle = -perpDist / focalLen;

              const currentAngle = Math.atan2(currentDir.y, currentDir.x);
              const newAngle = currentAngle + deltaAngle;
              const refrDir: Vector = {
                x: Math.cos(newAngle),
                y: Math.sin(newAngle)
              };

              activeRays.push({
                pos: {
                  x: hit.point.x + refrDir.x * 3,
                  y: hit.point.y + refrDir.y * 3
                },
                dir: normalize(refrDir),
                intensity: ray.intensity * 0.94,
                wavelength: ray.wavelength,
                path: [hit.point],
                bounces: ray.bounces + 1,
                insidePrismId: null,
                history: [...ray.history, hit.point]
              });

              pieceInteracted = true;
              isTerminated = true;
              break;
            }
          }
        }

        if (pieceInteracted || isTerminated) {
          break;
        }

        currentPos = nextPos;
        // Save sparse points to keep smooth curve
        if (s % 2 === 0) {
          ray.path.push({ ...currentPos });
        }
      }

      if (ray.path.length > 1) {
        this.flushRayToOutput(ray, outputRays);
      }
    }

    return { rays: outputRays, litTargets };
  }

  private checkColorMatch(wavelength: number | null, targetColor: string): boolean {
    if (targetColor === 'white') {
      return wavelength === null;
    }
    if (wavelength === null) {
      // White light contains all colors
      return true;
    }
    switch (targetColor) {
      case 'red':
        return wavelength >= 600;
      case 'green':
        return wavelength >= 495 && wavelength <= 580;
      case 'blue':
        return wavelength < 495;
      default:
        return false;
    }
  }

  private flushRayToOutput(ray: ActiveRay, outputRays: RaySegment[]) {
    if (ray.path.length < 2) return;

    let colorStr: string;
    if (ray.wavelength === null) {
      colorStr = `rgba(255, 245, 220, ${ray.intensity * 0.9})`; // White-gold beam
    } else {
      colorStr = wavelengthToRGB(ray.wavelength, ray.intensity * 0.95);
    }

    outputRays.push({
      path: [...ray.path],
      color: colorStr,
      wavelength: ray.wavelength || undefined,
      intensity: ray.intensity,
      width: ray.wavelength === null ? 3.5 : 2.5,
      isRainbow: ray.wavelength !== null
    });
    ray.path = [];
  }
}
