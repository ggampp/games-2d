import { Vector2 } from './Vector2.js';

export const VEHICLE_TYPES = {
  CAR: {
    id: 'CAR',
    name: 'Sedan Urbano',
    icon: '🚗',
    chassisWidth: 54,
    chassisHeight: 22,
    wheelBase: 40,
    wheelRadius: 8,
    totalMass: 25,
    enginePower: 85,
    maxSpeed: 100,
    color: '#e74c3c',
    roofColor: '#c0392b',
    description: 'Veículo leve e ágil. Perfeito para testes iniciais de deflexão da pista.'
  },
  VAN: {
    id: 'VAN',
    name: 'Ônibus Escolar',
    icon: '🚌',
    chassisWidth: 80,
    chassisHeight: 30,
    wheelBase: 62,
    wheelRadius: 10,
    totalMass: 55,
    enginePower: 70,
    maxSpeed: 70,
    color: '#f39c12',
    roofColor: '#d68910',
    description: 'Carga média e comprimento longo. Induz oscilações dinâmicas na estrutura.'
  },
  TRUCK: {
    id: 'TRUCK',
    name: 'Caminhão de Carga',
    icon: '🚛',
    chassisWidth: 105,
    chassisHeight: 36,
    wheelBase: 84,
    wheelRadius: 13,
    totalMass: 95,
    enginePower: 60,
    maxSpeed: 55,
    color: '#2980b9',
    roofColor: '#1f618d',
    description: 'Carga pesada industrial. Exige excelente triangulação e suporte inferior.'
  },
  MONSTER: {
    id: 'MONSTER',
    name: 'Monster Truck Titã',
    icon: '🚜',
    chassisWidth: 86,
    chassisHeight: 40,
    wheelBase: 68,
    wheelRadius: 18,
    totalMass: 140,
    enginePower: 110,
    maxSpeed: 75,
    color: '#8e44ad',
    roofColor: '#6c3483',
    description: 'Peso brutal concentrado e rodas gigantes. O teste de estresse supremo!'
  }
};

export class Vehicle {
  constructor(typeKey = 'CAR', startX = 60, startY = 240) {
    this.typeKey = typeKey;
    this.spec = VEHICLE_TYPES[typeKey] || VEHICLE_TYPES.CAR;

    this.pos = new Vector2(startX, startY);
    this.vel = new Vector2(0, 0);
    this.angle = 0;
    this.angularVel = 0;

    this.initialX = startX;
    this.initialY = startY;

    this.rearWheelGrounded = true;
    this.frontWheelGrounded = true;
    this.hasFallen = false;
    this.hasFinished = false;
    this.finishedTime = 0;

    this.wheelRotation = 0;
  }

  reset() {
    this.pos.set(this.initialX, this.initialY);
    this.vel.set(0, 0);
    this.angle = 0;
    this.angularVel = 0;
    this.rearWheelGrounded = true;
    this.frontWheelGrounded = true;
    this.hasFallen = false;
    this.hasFinished = false;
    this.finishedTime = 0;
    this.wheelRotation = 0;
  }

  setType(typeKey) {
    this.typeKey = typeKey;
    this.spec = VEHICLE_TYPES[typeKey] || VEHICLE_TYPES.CAR;
    this.reset();
  }

  getWheelPositions() {
    const halfBase = this.spec.wheelBase / 2;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    // Rear wheel
    const rwX = this.pos.x - cos * halfBase;
    const rwY = this.pos.y - sin * halfBase + 4;

    // Front wheel
    const fwX = this.pos.x + cos * halfBase;
    const fwY = this.pos.y + sin * halfBase + 4;

    return {
      rear: new Vector2(rwX, rwY),
      front: new Vector2(fwX, fwY)
    };
  }

  update(dt, roadBeams, leftCliff, rightCliff, groundY) {
    if (this.hasFinished) return;

    const gravity = 450;
    const halfBase = this.spec.wheelBase / 2;
    const wheels = this.getWheelPositions();

    let rearForce = this.resolveWheelContact(wheels.rear, dt, roadBeams, leftCliff, rightCliff);
    let frontForce = this.resolveWheelContact(wheels.front, dt, roadBeams, leftCliff, rightCliff);

    this.rearWheelGrounded = rearForce.grounded;
    this.frontWheelGrounded = frontForce.grounded;

    // Gravity force on vehicle center
    this.vel.y += gravity * dt;

    // Driving engine propulsion
    if (this.rearWheelGrounded || this.frontWheelGrounded) {
      if (this.vel.x < this.spec.maxSpeed) {
        const driveAcc = this.spec.enginePower * (this.rearWheelGrounded ? 1.0 : 0.6);
        this.vel.x += driveAcc * dt;
      }
      // Damping on air / rolling resistance
      this.vel.x *= Math.pow(0.985, dt * 60);
    } else {
      // Free flight air damping
      this.vel.x *= Math.pow(0.995, dt * 60);
    }

    // Apply normal impulses from wheels
    if (rearForce.grounded) {
      this.vel.y += rearForce.impulse.y / this.spec.totalMass;
      this.vel.x += rearForce.impulse.x / this.spec.totalMass;
    }
    if (frontForce.grounded) {
      this.vel.y += frontForce.impulse.y / this.spec.totalMass;
      this.vel.x += frontForce.impulse.x / this.spec.totalMass;
    }

    // Angular mechanics / torque between front and rear wheel heights
    if (rearForce.grounded && frontForce.grounded) {
      const targetAngle = Math.atan2(frontForce.contactY - rearForce.contactY, wheels.front.x - wheels.rear.x);
      const angleDiff = targetAngle - this.angle;
      this.angularVel += angleDiff * 35 * dt;
      this.angularVel *= Math.pow(0.85, dt * 60);
    } else if (rearForce.grounded) {
      this.angularVel += 4.0 * dt;
      this.angularVel *= Math.pow(0.92, dt * 60);
    } else if (frontForce.grounded) {
      this.angularVel -= 4.0 * dt;
      this.angularVel *= Math.pow(0.92, dt * 60);
    } else {
      // Falling rotational damping
      this.angularVel *= Math.pow(0.98, dt * 60);
    }

    // Update orientation & translation
    this.angle += this.angularVel * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // Wheel rotation animation
    this.wheelRotation += (this.vel.x / this.spec.wheelRadius) * dt;

    // Check abyss fall
    if (this.pos.y > groundY + 120) {
      this.hasFallen = true;
    }

    // Check level completion (passed right cliff)
    if (this.pos.x > rightCliff.startX + 60 && !this.hasFallen) {
      this.hasFinished = true;
      this.finishedTime = performance.now();
    }
  }

  resolveWheelContact(wheelPos, dt, roadBeams, leftCliff, rightCliff) {
    const r = this.spec.wheelRadius;
    let grounded = false;
    let contactY = wheelPos.y;
    let impulse = new Vector2(0, 0);

    // 1. Check solid cliff surfaces (approach roads)
    if (wheelPos.x <= leftCliff.endX) {
      if (wheelPos.y + r >= leftCliff.y) {
        grounded = true;
        contactY = leftCliff.y - r;
        const penetration = (wheelPos.y + r) - leftCliff.y;
        wheelPos.y = contactY;
        impulse.y -= penetration * 450;
      }
    } else if (wheelPos.x >= rightCliff.startX) {
      if (wheelPos.y + r >= rightCliff.y) {
        grounded = true;
        contactY = rightCliff.y - r;
        const penetration = (wheelPos.y + r) - rightCliff.y;
        wheelPos.y = contactY;
        impulse.y -= penetration * 450;
      }
    }

    // 2. Check active bridge road segments
    for (const beam of roadBeams) {
      if (beam.isBroken || !beam.material.isRoad) continue;

      const pA = beam.nodeA.pos;
      const pB = beam.nodeB.pos;

      const segX = pB.x - pA.x;
      const segY = pB.y - pA.y;
      const segLenSq = segX * segX + segY * segY;

      if (segLenSq < 1) continue;

      // Project wheel position onto line segment
      const t = Math.max(0, Math.min(1, ((wheelPos.x - pA.x) * segX + (wheelPos.y - pA.y) * segY) / segLenSq));
      const projX = pA.x + t * segX;
      const projY = pA.y + t * segY;

      const distSq = (wheelPos.x - projX) * (wheelPos.x - projX) + (wheelPos.y - projY) * (wheelPos.y - projY);

      // Check collision
      if (distSq < (r + 4) * (r + 4)) {
        grounded = true;
        contactY = projY - r;

        const dist = Math.sqrt(distSq);
        const overlap = (r + 4) - dist;

        // Vehicle push back
        impulse.y -= overlap * 520;

        // Apply load force to bridge nodes (distributed by t)
        const wheelWeight = (this.spec.totalMass * 0.5 * 9.8) * 1.6;
        const loadForceY = wheelWeight + Math.max(0, this.vel.y) * 15;

        beam.nodeA.applyForce(0, loadForceY * (1 - t));
        beam.nodeB.applyForce(0, loadForceY * t);
      }
    }

    return { grounded, contactY, impulse };
  }
}
