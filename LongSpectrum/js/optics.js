/**
 * The Long Spectrum - Optics & Raycasting Engine
 * Simulates volumetric beams, specular reflection, Snell's law refraction,
 * and Cauchy chromatic dispersion across triangular prisms.
 */

// Wavelength to RGB conversion (380nm - 750nm)
function wavelengthToRGB(wavelength, gamma = 0.8) {
    let r = 0, g = 0, b = 0;
    const w = wavelength;

    if (w >= 380 && w < 440) {
        r = -(w - 440) / (440 - 380);
        g = 0.0;
        b = 1.0;
    } else if (w >= 440 && w < 490) {
        r = 0.0;
        g = (w - 440) / (490 - 440);
        b = 1.0;
    } else if (w >= 490 && w < 510) {
        r = 0.0;
        g = 1.0;
        b = -(w - 510) / (510 - 490);
    } else if (w >= 510 && w < 580) {
        r = (w - 510) / (580 - 510);
        g = 1.0;
        b = 0.0;
    } else if (w >= 580 && w < 645) {
        r = 1.0;
        g = -(w - 645) / (645 - 580);
        b = 0.0;
    } else if (w >= 645 && w <= 750) {
        r = 1.0;
        g = 0.0;
        b = 0.0;
    }

    // Intensity falloff near vision limits
    let factor = 0.0;
    if (w >= 380 && w < 420) {
        factor = 0.3 + 0.7 * (w - 380) / (420 - 380);
    } else if (w >= 420 && w < 700) {
        factor = 1.0;
    } else if (w >= 700 && w <= 750) {
        factor = 0.3 + 0.7 * (750 - w) / (750 - 700);
    }

    return {
        r: Math.round(255 * Math.pow(r * factor, gamma)),
        g: Math.round(255 * Math.pow(g * factor, gamma)),
        b: Math.round(255 * Math.pow(b * factor, gamma))
    };
}

class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    sub(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    mul(s) {
        return new Vector2(this.x * s, this.y * s);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    cross(v) {
        return this.x * v.y - this.y * v.x;
    }

    length() {
        return Math.hypot(this.x, this.y);
    }

    normalize() {
        const len = this.length();
        return len > 0.00001 ? new Vector2(this.x / len, this.y / len) : new Vector2(0, 0);
    }

    distanceTo(v) {
        return Math.hypot(this.x - v.x, this.y - v.y);
    }

    rotate(angleRad) {
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        return new Vector2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }
}

// Ray intersection helper with line segment
function raySegmentIntersect(rayOrigin, rayDir, segA, segB) {
    const p = rayOrigin;
    const r = rayDir;
    const q = segA;
    const s = segB.sub(segA);

    const rxs = r.cross(s);
    if (Math.abs(rxs) < 1e-7) return null; // Parallel

    const qp = q.sub(p);
    const t = qp.cross(s) / rxs;
    const u = qp.cross(r) / rxs;

    if (t > 1e-4 && u >= 0 && u <= 1) {
        const hitPoint = p.add(r.mul(t));
        // Compute segment normal pointing towards ray origin
        const segVec = segB.sub(segA);
        let normal = new Vector2(-segVec.y, segVec.x).normalize();
        if (normal.dot(r) > 0) {
            normal = normal.mul(-1);
        }
        return {
            point: hitPoint,
            distance: t,
            normal: normal,
            u: u
        };
    }
    return null;
}

// Ray-Circle intersection for Target detection
function rayCircleIntersect(p1, p2, circleCenter, radius) {
    const d = p2.sub(p1);
    const f = p1.sub(circleCenter);

    const a = d.dot(d);
    const b = 2 * f.dot(d);
    const c = f.dot(f) - radius * radius;

    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) {
        return true;
    }
    return false;
}

class OpticsEngine {
    constructor() {
        this.maxBounces = 16;
        this.numSubRays = 45; // Number of rays per beam for rich volumetric & spectral density
        this.dispersionStrength = 0.085; // Cauchy dispersion coefficient
        this.baseRefractiveIndex = 1.52; // Crown glass
    }

    getPrismVertices(center, size, angleRad) {
        // Equilateral triangle centered at `center`
        const r = size / Math.sqrt(3);
        const p1 = new Vector2(0, -r).rotate(angleRad).add(center);
        const p2 = new Vector2(-size / 2, r / 2).rotate(angleRad).add(center);
        const p3 = new Vector2(size / 2, r / 2).rotate(angleRad).add(center);
        return [p1, p2, p3];
    }

    getMirrorSegment(center, length, angleRad) {
        const half = length / 2;
        const dir = new Vector2(Math.cos(angleRad), Math.sin(angleRad));
        const p1 = center.sub(dir.mul(half));
        const p2 = center.add(dir.mul(half));
        return { p1, p2, center, angleRad, length };
    }

    getWallSegments(walls) {
        const segments = [];
        for (const wall of walls) {
            const { x, y, width, height } = wall;
            const p1 = new Vector2(x, y);
            const p2 = new Vector2(x + width, y);
            const p3 = new Vector2(x + width, y + height);
            const p4 = new Vector2(x, y + height);
            segments.push({ p1: p1, p2: p2, isWall: true });
            segments.push({ p1: p2, p2: p3, isWall: true });
            segments.push({ p1: p3, p2: p4, isWall: true });
            segments.push({ p1: p4, p2: p1, isWall: true });
        }
        return segments;
    }

    // Trace single ray through world
    traceRay(startOrigin, startDir, wavelength, isWhite, intensity, mirrors, prisms, wallSegments, secondaryBeams = []) {
        const segments = [];
        let curOrigin = startOrigin.clone();
        let curDir = startDir.normalize();
        let curIntensity = intensity;
        let insidePrism = null; // Reference to prism object if ray is travelling inside glass

        // Refractive index for this wavelength (Cauchy's dispersion equation: n = A + B/lambda^2)
        // wavelength in nm (380 to 700)
        const lambdaNorm = (wavelength - 380) / (700 - 380); // 0 (violet) to 1 (red)
        // Shorter wavelengths (violet/blue) have higher index and bend more
        const prismN = this.baseRefractiveIndex + (1 - lambdaNorm) * this.dispersionStrength;

        for (let bounce = 0; bounce < this.maxBounces; bounce++) {
            if (curIntensity < 0.03) break;

            let closestHit = null;
            let hitType = null;
            let hitObject = null;
            let hitEdgeIndex = -1;

            // 1. Check walls
            for (const wallSeg of wallSegments) {
                const hit = raySegmentIntersect(curOrigin, curDir, wallSeg.p1, wallSeg.p2);
                if (hit && (!closestHit || hit.distance < closestHit.distance)) {
                    closestHit = hit;
                    hitType = 'wall';
                    hitObject = wallSeg;
                }
            }

            // 2. Check mirrors (only if outside prism)
            if (!insidePrism) {
                for (const mirror of mirrors) {
                    const seg = this.getMirrorSegment(new Vector2(mirror.x, mirror.y), mirror.length || 85, mirror.rotation);
                    const hit = raySegmentIntersect(curOrigin, curDir, seg.p1, seg.p2);
                    if (hit && (!closestHit || hit.distance < closestHit.distance)) {
                        closestHit = hit;
                        hitType = 'mirror';
                        hitObject = mirror;
                    }
                }
            }

            // 3. Check prisms
            for (const prism of prisms) {
                const vertices = this.getPrismVertices(new Vector2(prism.x, prism.y), prism.size || 76, prism.rotation);
                const edges = [
                    { p1: vertices[0], p2: vertices[1], idx: 0 },
                    { p1: vertices[1], p2: vertices[2], idx: 1 },
                    { p1: vertices[2], p2: vertices[0], idx: 2 }
                ];

                for (const edge of edges) {
                    // Avoid self-hit at start of ray inside or outside
                    const hit = raySegmentIntersect(curOrigin, curDir, edge.p1, edge.p2);
                    if (hit && (!closestHit || hit.distance < closestHit.distance)) {
                        closestHit = hit;
                        hitType = 'prism';
                        hitObject = prism;
                        hitEdgeIndex = edge.idx;
                    }
                }
            }

            if (!closestHit) {
                // Ray goes offscreen
                const endPoint = curOrigin.add(curDir.mul(1400));
                segments.push({
                    from: curOrigin,
                    to: endPoint,
                    intensity: curIntensity,
                    wavelength: wavelength,
                    isWhite: isWhite,
                    insideGlass: !!insidePrism
                });
                break;
            }

            // Record segment
            segments.push({
                from: curOrigin,
                to: closestHit.point,
                intensity: curIntensity,
                wavelength: wavelength,
                isWhite: isWhite,
                insideGlass: !!insidePrism
            });

            if (hitType === 'wall') {
                break; // Light is absorbed by wall
            } else if (hitType === 'mirror') {
                // Specular reflection: r = d - 2(d.n)n
                const normal = closestHit.normal;
                const dot = curDir.dot(normal);
                const reflectDir = curDir.sub(normal.mul(2 * dot)).normalize();

                curOrigin = closestHit.point.add(reflectDir.mul(0.01));
                curDir = reflectDir;
                curIntensity *= 0.96; // Slight mirror loss
            } else if (hitType === 'prism') {
                // Refraction / Dispersion with Snell's law
                const n1 = insidePrism ? prismN : 1.0;
                const n2 = insidePrism ? 1.0 : prismN;
                const nRatio = n1 / n2;

                const normal = closestHit.normal; // Points towards incident medium
                const cosI = -curDir.dot(normal);
                const sinT2 = nRatio * nRatio * (1.0 - cosI * cosI);

                // Optional secondary beam for subtle entrance reflection (Fresnel effect)
                if (!insidePrism && secondaryBeams && secondaryBeams.length < 8 && bounce === 0) {
                    const fresnelReflectDir = curDir.sub(normal.mul(2 * curDir.dot(normal))).normalize();
                    secondaryBeams.push({
                        from: closestHit.point,
                        to: closestHit.point.add(fresnelReflectDir.mul(280)),
                        intensity: curIntensity * 0.15,
                        wavelength: wavelength,
                        isWhite: isWhite
                    });
                }

                if (sinT2 > 1.0) {
                    // Total Internal Reflection (TIR)
                    const tirDir = curDir.sub(normal.mul(2 * curDir.dot(normal))).normalize();
                    curOrigin = closestHit.point.add(tirDir.mul(0.02));
                    curDir = tirDir;
                } else {
                    // Refraction (Snell's law vector form)
                    const cosT = Math.sqrt(1.0 - sinT2);
                    const refractDir = curDir.mul(nRatio).add(normal.mul(nRatio * cosI - cosT)).normalize();

                    curOrigin = closestHit.point.add(refractDir.mul(0.05));
                    curDir = refractDir;

                    if (!insidePrism) {
                        insidePrism = hitObject; // Entered prism
                    } else {
                        insidePrism = null; // Exited prism
                    }
                }
                // Once entering a prism, white light splits into its individual wavelength ray
                isWhite = false;
                curIntensity *= 0.98;
            }
        }

        return segments;
    }

    // Simulate the complete light field from all emitters
    simulate(emitters, mirrors, prisms, walls, targets) {
        const wallSegments = this.getWallSegments(walls);
        const allSegments = [];
        const secondaryBeams = [];

        // Reset target spectral accumulator
        const targetEnergy = targets.map(() => ({
            totalIntensity: 0,
            redEnergy: 0,
            greenEnergy: 0,
            blueEnergy: 0,
            illuminatedWavelengths: []
        }));

        for (const emitter of emitters) {
            const emitterCenter = new Vector2(emitter.x, emitter.y);
            const beamDir = new Vector2(Math.cos(emitter.rotation), Math.sin(emitter.rotation)).normalize();
            const beamNormal = new Vector2(-beamDir.y, beamDir.x); // Perpendicular across beam thickness
            const beamWidth = emitter.beamWidth || 30;

            const nRays = this.numSubRays;

            for (let i = 0; i < nRays; i++) {
                // Spread rays evenly across the beam thickness
                const offsetFactor = (i / (nRays - 1)) - 0.5; // -0.5 to +0.5
                const rayOffset = beamNormal.mul(offsetFactor * beamWidth);
                const rayOrigin = emitterCenter.add(rayOffset);

                // Sample continuous visible spectrum (390nm to 690nm) mapped across beam or sub-rays
                const wavelength = 390 + (i / (nRays - 1)) * (690 - 390);

                // Initial beam is coherent white light with subtle chromatic edges
                const isWhite = true;
                const baseIntensity = 1.0 - Math.pow(Math.abs(offsetFactor) * 1.5, 3); // Soft beam edge falloff

                const raySegments = this.traceRay(
                    rayOrigin,
                    beamDir,
                    wavelength,
                    isWhite,
                    Math.max(0.2, baseIntensity),
                    mirrors,
                    prisms,
                    wallSegments,
                    secondaryBeams
                );

                for (const seg of raySegments) {
                    allSegments.push(seg);

                    // Check if this segment hits any targets
                    targets.forEach((target, tIdx) => {
                        const targetCenter = new Vector2(target.x, target.y);
                        const radius = target.radius || 28;
                        if (rayCircleIntersect(seg.from, seg.to, targetCenter, radius)) {
                            const rgb = wavelengthToRGB(seg.wavelength);
                            const e = targetEnergy[tIdx];
                            e.totalIntensity += seg.intensity;
                            e.redEnergy += (rgb.r / 255) * seg.intensity;
                            e.greenEnergy += (rgb.g / 255) * seg.intensity;
                            e.blueEnergy += (rgb.b / 255) * seg.intensity;
                            e.illuminatedWavelengths.push({
                                wavelength: seg.wavelength,
                                isWhite: seg.isWhite,
                                intensity: seg.intensity
                            });
                        }
                    });
                }
            }
        }

        // Determine target activation status based on spectral match
        const targetResults = targets.map((target, idx) => {
            const e = targetEnergy[idx];
            let active = false;
            let matchScore = 0;

            if (e.totalIntensity > 1.2) {
                // Check if incoming light matches target filter:
                // blue target: dominant blue wavelength (wavelength < 500nm and not purely white unless specified)
                // green target: dominant green (500nm - 580nm)
                // orange/red target: dominant red/orange (580nm - 700nm)
                const totalColor = e.redEnergy + e.greenEnergy + e.blueEnergy + 0.001;
                const rRatio = e.redEnergy / totalColor;
                const gRatio = e.greenEnergy / totalColor;
                const bRatio = e.blueEnergy / totalColor;

                // Check dispersion purity (how distinct the band is)
                const hasDispersedRay = e.illuminatedWavelengths.some(w => !w.isWhite);

                if (target.color === 'blue') {
                    // Blue target requires strong blue channel and low red
                    matchScore = bRatio - (rRatio * 0.6);
                    active = matchScore > 0.42 && (hasDispersedRay || target.allowWhite);
                } else if (target.color === 'green') {
                    // Green target requires strong green channel
                    matchScore = gRatio - (rRatio * 0.3) - (bRatio * 0.3);
                    active = matchScore > 0.38 && (hasDispersedRay || target.allowWhite);
                } else if (target.color === 'orange' || target.color === 'red') {
                    // Orange/Red target requires dominant red/orange channel
                    matchScore = rRatio - (bRatio * 0.7);
                    active = matchScore > 0.44 && (hasDispersedRay || target.allowWhite);
                } else if (target.color === 'white') {
                    active = e.totalIntensity > 3.0;
                    matchScore = 1.0;
                }
            }

            return {
                target: target,
                active: active,
                energy: e,
                matchScore: Math.max(0, Math.min(1, matchScore))
            };
        });

        return {
            segments: allSegments,
            secondaryBeams: secondaryBeams,
            targetResults: targetResults
        };
    }
}

// Export to window
window.OpticsEngine = OpticsEngine;
window.Vector2 = Vector2;
window.wavelengthToRGB = wavelengthToRGB;
