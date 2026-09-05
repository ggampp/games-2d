import { GODS, DEVOTION_MILESTONES, JEALOUSY_THRESHOLD, JEALOUSY_DIFF_TRIGGER, type God } from "../data/gods";
import { BESTOWS, type Bestow } from "../data/bestows";

export interface DevotionState {
  nylea: number;
  heliod: number;
  unlockedBestows: string[];
  activeJealousy: string | null;
  jealousyEventPending: boolean;
}

export type DevotionEventType =
  | "devotion_changed"
  | "bestow_unlocked"
  | "jealousy_warning"
  | "jealousy_event"
  | "milestone_reached";

export interface DevotionEvent {
  type: DevotionEventType;
  godId?: string;
  bestow?: Bestow;
  value?: number;
  message?: string;
}

type DevotionCallback = (event: DevotionEvent) => void;

export class DevotionSystem {
  private state: DevotionState;
  private listeners: DevotionCallback[] = [];

  constructor() {
    this.state = {
      nylea: 0,
      heliod: 0,
      unlockedBestows: [],
      activeJealousy: null,
      jealousyEventPending: false,
    };
  }

  getState(): Readonly<DevotionState> {
    return this.state;
  }

  getDevotion(godId: string): number {
    return godId === "nylea" ? this.state.nylea : this.state.heliod;
  }

  addDevotion(godId: string, amount: number): void {
    const prevValue = this.getDevotion(godId);
    const newValue = Math.min(100, Math.max(0, prevValue + amount));

    if (godId === "nylea") {
      this.state.nylea = newValue;
    } else {
      this.state.heliod = newValue;
    }

    this.emit({ type: "devotion_changed", godId, value: newValue });

    this.checkMilestones(godId, prevValue, newValue);
    this.checkJealousy(godId);
  }

  removeDevotion(godId: string, amount: number): void {
    this.addDevotion(godId, -amount);
  }

  removeAllDevotion(amount: number): void {
    this.removeDevotion("nylea", amount);
    this.removeDevotion("heliod", amount);
  }

  private checkMilestones(godId: string, prev: number, current: number): void {
    for (const milestone of DEVOTION_MILESTONES) {
      if (prev < milestone && current >= milestone) {
        this.emit({ type: "milestone_reached", godId, value: milestone });

        const newBestows = BESTOWS.filter(
          (b) =>
            b.godId === godId &&
            b.requiredDevotion === milestone &&
            !this.state.unlockedBestows.includes(b.id)
        );

        for (const bestow of newBestows) {
          this.state.unlockedBestows.push(bestow.id);
          this.emit({ type: "bestow_unlocked", godId, bestow });
        }
      }
    }
  }

  private checkJealousy(favoredGod: string): void {
    const god = GODS[favoredGod];
    const rivalId = god.rival;
    const rivalGod = GODS[rivalId];

    const favoredDevotion = this.getDevotion(favoredGod);
    const rivalDevotion = this.getDevotion(rivalId);

    if (rivalDevotion >= JEALOUSY_THRESHOLD) {
      const diff = favoredDevotion - rivalDevotion;

      if (diff >= JEALOUSY_DIFF_TRIGGER && this.state.activeJealousy !== rivalId) {
        this.state.activeJealousy = rivalId;
        this.emit({
          type: "jealousy_warning",
          godId: rivalId,
          message: rivalGod.jealousyWarning,
        });
        this.state.jealousyEventPending = true;
      }
    }
  }

  triggerJealousyEvent(): DevotionEvent | null {
    if (!this.state.jealousyEventPending || !this.state.activeJealousy) {
      return null;
    }

    const jealousGod = GODS[this.state.activeJealousy];
    this.state.jealousyEventPending = false;

    const event: DevotionEvent = {
      type: "jealousy_event",
      godId: this.state.activeJealousy,
      message: jealousGod.jealousyEvent,
    };

    this.emit(event);
    return event;
  }

  clearJealousy(): void {
    this.state.activeJealousy = null;
    this.state.jealousyEventPending = false;
  }

  isJealousyPending(): boolean {
    return this.state.jealousyEventPending;
  }

  getUnlockedBestows(): Bestow[] {
    return BESTOWS.filter((b) => this.state.unlockedBestows.includes(b.id));
  }

  getAvailableBestowsForGod(godId: string): Bestow[] {
    const devotion = this.getDevotion(godId);
    return BESTOWS.filter(
      (b) =>
        b.godId === godId &&
        devotion >= b.requiredDevotion &&
        this.state.unlockedBestows.includes(b.id)
    );
  }

  on(callback: DevotionCallback): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: DevotionEvent): void {
    for (const cb of this.listeners) {
      cb(event);
    }
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data);
      this.state = { ...this.state, ...parsed };
    } catch {
      console.warn("Failed to deserialize devotion state");
    }
  }
}
