import { BESTOWS, type Bestow } from "../data/bestows";

export interface ActiveBestowState {
  bestowId: string;
  expiresAt: number | null;
  cooldownEndsAt: number;
}

export class BestowSystem {
  private activeBestows: Map<string, ActiveBestowState> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private equippedSlots: (Bestow | null)[] = [null, null, null, null];
  /** Cura pendente a ser consumida pela cena */
  private pendingHeal = 0;

  equipBestow(slot: number, bestow: Bestow | null): void {
    if (slot < 0 || slot > 3) return;
    this.equippedSlots[slot] = bestow;
  }

  /** Coloca a bênção no primeiro slot vazio (se ainda não estiver equipada) */
  autoEquip(bestow: Bestow): number {
    const existing = this.equippedSlots.findIndex((b) => b?.id === bestow.id);
    if (existing >= 0) return existing;
    const empty = this.equippedSlots.findIndex((b) => b === null);
    if (empty >= 0) this.equippedSlots[empty] = bestow;
    return empty;
  }

  getEquippedSlots(): readonly (Bestow | null)[] {
    return this.equippedSlots;
  }

  getEquippedBestow(slot: number): Bestow | null {
    return this.equippedSlots[slot] ?? null;
  }

  canActivate(bestow: Bestow, now: number): boolean {
    const cooldownEnd = this.cooldowns.get(bestow.id) ?? 0;
    return now >= cooldownEnd && !this.activeBestows.has(bestow.id);
  }

  activate(bestow: Bestow, now: number): boolean {
    if (!this.canActivate(bestow, now)) return false;

    const effect = bestow.effect;
    const cooldownEndsAt = now + effect.cooldown;
    this.cooldowns.set(bestow.id, cooldownEndsAt);

    if (effect.type === "heal") {
      this.pendingHeal += effect.value;
      return true;
    }

    this.activeBestows.set(bestow.id, {
      bestowId: bestow.id,
      expiresAt: effect.duration ? now + effect.duration : null,
      cooldownEndsAt,
    });
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

  getCooldownRemaining(bestowId: string, now: number): number {
    const cooldownEnd = this.cooldowns.get(bestowId) ?? 0;
    return Math.max(0, cooldownEnd - now);
  }

  /** 0..1 — fração do cooldown restante (0 = pronto) */
  getCooldownFraction(bestow: Bestow, now: number): number {
    const remaining = this.getCooldownRemaining(bestow.id, now);
    return bestow.effect.cooldown > 0 ? remaining / bestow.effect.cooldown : 0;
  }

  /** 0..1 — fração da duração restante de um efeito ativo */
  getActiveFraction(bestow: Bestow, now: number): number {
    const state = this.activeBestows.get(bestow.id);
    if (!state || state.expiresAt === null || !bestow.effect.duration) return state ? 1 : 0;
    return Math.max(0, (state.expiresAt - now) / bestow.effect.duration);
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

  /** Consome e devolve a cura acumulada */
  takePendingHeal(): number {
    const v = this.pendingHeal;
    this.pendingHeal = 0;
    return v;
  }

  hasShield(): boolean {
    return this.equippedSlots.some((s) => s && this.isActive(s.id) && s.effect.type === "shield");
  }

  /** Escudo bloqueia o próximo golpe por completo e se dissipa */
  consumeShield(damage: number): { absorbed: number; remaining: number } {
    for (const slot of this.equippedSlots) {
      if (slot && this.isActive(slot.id) && slot.effect.type === "shield") {
        this.activeBestows.delete(slot.id);
        return { absorbed: damage, remaining: 0 };
      }
    }
    return { absorbed: 0, remaining: damage };
  }

  serializeEquipped(): string[] {
    return this.equippedSlots.map((b) => b?.id ?? "");
  }

  restoreEquipped(ids: string[]): void {
    ids.forEach((id, i) => {
      const b = BESTOWS.find((x) => x.id === id) ?? null;
      this.equipBestow(i, b);
    });
  }

  reset(): void {
    this.activeBestows.clear();
    this.cooldowns.clear();
    this.pendingHeal = 0;
  }
}
