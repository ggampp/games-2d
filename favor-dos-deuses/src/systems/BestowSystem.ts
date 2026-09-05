import type { Bestow, BestowEffect } from "../data/bestows";

export interface ActiveBestowState {
  bestowId: string;
  expiresAt: number | null;
  cooldownEndsAt: number;
}

export interface BestowSystemEvents {
  onActivate: (bestow: Bestow) => void;
  onDeactivate: (bestow: Bestow) => void;
  onCooldownEnd: (bestow: Bestow) => void;
}

export class BestowSystem {
  private activeBestows: Map<string, ActiveBestowState> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private equippedSlots: (Bestow | null)[] = [null, null, null, null];
  private events: BestowSystemEvents;

  constructor(events: Partial<BestowSystemEvents> = {}) {
    this.events = {
      onActivate: events.onActivate ?? (() => {}),
      onDeactivate: events.onDeactivate ?? (() => {}),
      onCooldownEnd: events.onCooldownEnd ?? (() => {}),
    };
  }

  equipBestow(slot: number, bestow: Bestow | null): void {
    if (slot < 0 || slot > 3) return;
    this.equippedSlots[slot] = bestow;
  }

  getEquippedSlots(): readonly (Bestow | null)[] {
    return this.equippedSlots;
  }

  getEquippedBestow(slot: number): Bestow | null {
    return this.equippedSlots[slot] ?? null;
  }

  canActivate(bestow: Bestow, now: number): boolean {
    const cooldownEnd = this.cooldowns.get(bestow.id) ?? 0;
    return now >= cooldownEnd;
  }

  activate(bestow: Bestow, now: number): boolean {
    if (!this.canActivate(bestow, now)) {
      return false;
    }

    const effect = bestow.effect;
    const expiresAt = effect.duration ? now + effect.duration : null;
    const cooldownEndsAt = now + effect.cooldown;

    this.activeBestows.set(bestow.id, {
      bestowId: bestow.id,
      expiresAt,
      cooldownEndsAt,
    });

    this.cooldowns.set(bestow.id, cooldownEndsAt);
    this.events.onActivate(bestow);

    return true;
  }

  update(now: number): void {
    for (const [id, state] of this.activeBestows.entries()) {
      if (state.expiresAt !== null && now >= state.expiresAt) {
        this.activeBestows.delete(id);
      }
    }
  }

  isActive(bestowId: string): boolean {
    return this.activeBestows.has(bestowId);
  }

  getActiveEffect(bestowId: string): ActiveBestowState | null {
    return this.activeBestows.get(bestowId) ?? null;
  }

  getCooldownRemaining(bestowId: string, now: number): number {
    const cooldownEnd = this.cooldowns.get(bestowId) ?? 0;
    return Math.max(0, cooldownEnd - now);
  }

  getActiveEffects(): { bestow: Bestow; state: ActiveBestowState }[] {
    const results: { bestow: Bestow; state: ActiveBestowState }[] = [];
    for (const slot of this.equippedSlots) {
      if (slot && this.activeBestows.has(slot.id)) {
        results.push({
          bestow: slot,
          state: this.activeBestows.get(slot.id)!,
        });
      }
    }
    return results;
  }

  getDamageMultiplier(): number {
    let mult = 1;
    for (const slot of this.equippedSlots) {
      if (slot && this.isActive(slot.id) && slot.effect.type === "damage_boost") {
        mult *= slot.effect.value;
      }
    }
    return mult;
  }

  getSpeedMultiplier(): number {
    let mult = 1;
    for (const slot of this.equippedSlots) {
      if (slot && this.isActive(slot.id) && slot.effect.type === "speed_boost") {
        mult *= slot.effect.value;
      }
    }
    return mult;
  }

  getHealAmount(): number {
    let total = 0;
    for (const slot of this.equippedSlots) {
      if (slot && this.isActive(slot.id) && slot.effect.type === "heal") {
        total += slot.effect.value;
        this.activeBestows.delete(slot.id);
      }
    }
    return total;
  }

  getShieldAmount(): number {
    let total = 0;
    for (const slot of this.equippedSlots) {
      if (slot && this.isActive(slot.id) && slot.effect.type === "shield") {
        total += slot.effect.value;
      }
    }
    return total;
  }

  consumeShield(damage: number): { absorbed: number; remaining: number } {
    let remainingDamage = damage;

    for (const slot of this.equippedSlots) {
      if (slot && this.isActive(slot.id) && slot.effect.type === "shield") {
        const shieldValue = slot.effect.value;
        if (remainingDamage >= shieldValue) {
          remainingDamage -= shieldValue;
          this.activeBestows.delete(slot.id);
        } else {
          remainingDamage = 0;
          break;
        }
      }
    }

    return {
      absorbed: damage - remainingDamage,
      remaining: remainingDamage,
    };
  }

  reset(): void {
    this.activeBestows.clear();
    this.cooldowns.clear();
  }
}
