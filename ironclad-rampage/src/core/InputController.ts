import * as THREE from 'three';

type PointerState = {
  active: boolean;
  id: number | null;
  centerX: number;
  centerY: number;
  radius: number;
};

export class InputController {
  private readonly keys = new Set<string>();
  private readonly pointer = new THREE.Vector2();
  private readonly keyVector = new THREE.Vector2();
  private readonly pointerState: PointerState = {
    active: false,
    id: null,
    centerX: 0,
    centerY: 0,
    radius: 1,
  };

  private attackPressed = false;
  private specialPressed = false;
  private attackHeld = false;
  private specialHeld = false;
  private startPressed = false;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    this.keys.add(event.code);
    if (event.code === 'KeyJ' || event.code === 'KeyZ' || event.code === 'Space') {
      if (!this.attackHeld) this.attackPressed = true;
      this.attackHeld = true;
    }
    if (event.code === 'KeyK' || event.code === 'KeyX') {
      if (!this.specialHeld) this.specialPressed = true;
      this.specialHeld = true;
    }
    if (event.code === 'Enter' || event.code === 'KeyP') {
      this.startPressed = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === 'KeyJ' || event.code === 'KeyZ' || event.code === 'Space') {
      this.attackHeld = false;
    }
    if (event.code === 'KeyK' || event.code === 'KeyX') {
      this.specialHeld = false;
    }
  };

  private readonly onStickDown = (event: PointerEvent) => {
    event.preventDefault();
    const rect = this.stick.getBoundingClientRect();
    this.pointerState.active = true;
    this.pointerState.id = event.pointerId;
    this.pointerState.centerX = rect.left + rect.width / 2;
    this.pointerState.centerY = rect.top + rect.height / 2;
    this.pointerState.radius = rect.width * 0.42;
    try {
      this.stick.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    this.updatePointer(event.clientX, event.clientY);
  };

  private readonly onStickMove = (event: PointerEvent) => {
    if (!this.pointerState.active || event.pointerId !== this.pointerState.id) return;
    event.preventDefault();
    this.updatePointer(event.clientX, event.clientY);
  };

  private readonly onStickUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerState.id) return;
    event.preventDefault();
    this.pointerState.active = false;
    this.pointerState.id = null;
    this.pointer.set(0, 0);
    this.updateKnob();
  };

  private readonly onAttackDown = (event: PointerEvent) => {
    event.preventDefault();
    if (!this.attackHeld) this.attackPressed = true;
    this.attackHeld = true;
  };

  private readonly onAttackUp = (event: PointerEvent) => {
    event.preventDefault();
    this.attackHeld = false;
  };

  private readonly onSpecialDown = (event: PointerEvent) => {
    event.preventDefault();
    if (!this.specialHeld) this.specialPressed = true;
    this.specialHeld = true;
  };

  private readonly onSpecialUp = (event: PointerEvent) => {
    event.preventDefault();
    this.specialHeld = false;
  };

  constructor(
    private readonly stick: HTMLElement,
    private readonly knob: HTMLElement,
    private readonly attackButton: HTMLElement,
    private readonly specialButton: HTMLElement,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.stick.addEventListener('pointerdown', this.onStickDown);
    this.stick.addEventListener('pointermove', this.onStickMove);
    this.stick.addEventListener('pointerup', this.onStickUp);
    this.stick.addEventListener('pointercancel', this.onStickUp);
    this.attackButton.addEventListener('pointerdown', this.onAttackDown);
    this.attackButton.addEventListener('pointerup', this.onAttackUp);
    this.attackButton.addEventListener('pointercancel', this.onAttackUp);
    this.attackButton.addEventListener('pointerleave', this.onAttackUp);
    this.specialButton.addEventListener('pointerdown', this.onSpecialDown);
    this.specialButton.addEventListener('pointerup', this.onSpecialUp);
    this.specialButton.addEventListener('pointercancel', this.onSpecialUp);
    this.specialButton.addEventListener('pointerleave', this.onSpecialUp);
  }

  readMovement(target: THREE.Vector2): THREE.Vector2 {
    this.keyVector.set(0, 0);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.keyVector.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.keyVector.x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.keyVector.y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.keyVector.y += 1;

    target.copy(this.keyVector).add(this.pointer);
    if (target.lengthSq() > 1) target.normalize();
    return target;
  }

  consumeAttack(): boolean {
    if (!this.attackPressed) return false;
    this.attackPressed = false;
    return true;
  }

  consumeSpecial(): boolean {
    if (!this.specialPressed) return false;
    this.specialPressed = false;
    return true;
  }

  consumeStart(): boolean {
    if (!this.startPressed) return false;
    this.startPressed = false;
    return true;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.stick.removeEventListener('pointerdown', this.onStickDown);
    this.stick.removeEventListener('pointermove', this.onStickMove);
    this.stick.removeEventListener('pointerup', this.onStickUp);
    this.stick.removeEventListener('pointercancel', this.onStickUp);
    this.attackButton.removeEventListener('pointerdown', this.onAttackDown);
    this.attackButton.removeEventListener('pointerup', this.onAttackUp);
    this.attackButton.removeEventListener('pointercancel', this.onAttackUp);
    this.attackButton.removeEventListener('pointerleave', this.onAttackUp);
    this.specialButton.removeEventListener('pointerdown', this.onSpecialDown);
    this.specialButton.removeEventListener('pointerup', this.onSpecialUp);
    this.specialButton.removeEventListener('pointercancel', this.onSpecialUp);
    this.specialButton.removeEventListener('pointerleave', this.onSpecialUp);
  }

  private updatePointer(clientX: number, clientY: number): void {
    const dx = clientX - this.pointerState.centerX;
    const dy = clientY - this.pointerState.centerY;
    this.pointer.set(dx / this.pointerState.radius, dy / this.pointerState.radius);
    if (this.pointer.lengthSq() > 1) this.pointer.normalize();
    this.updateKnob();
  }

  private updateKnob(): void {
    const distance = 38;
    this.knob.style.transform = `translate(calc(-50% + ${this.pointer.x * distance}px), calc(-50% + ${this.pointer.y * distance}px))`;
  }
}
