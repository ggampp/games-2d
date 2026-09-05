export interface Bestow {
  id: string;
  name: string;
  description: string;
  godId: string;
  requiredDevotion: number;
  icon: string;
  effect: BestowEffect;
}

export interface BestowEffect {
  type: "damage_boost" | "speed_boost" | "heal" | "shield" | "area_damage";
  value: number;
  duration?: number;
  cooldown: number;
}

export const BESTOWS: Bestow[] = [
  {
    id: "arrow_nylea",
    name: "Flecha de Nylea",
    description: "Dispara uma flecha guiada pela deusa que causa dano extra.",
    godId: "nylea",
    requiredDevotion: 25,
    icon: "🏹",
    effect: { type: "damage_boost", value: 1.5, duration: 5000, cooldown: 8000 },
  },
  {
    id: "forest_stride",
    name: "Passo Florestal",
    description: "Move-se como um cervo através das matas.",
    godId: "nylea",
    requiredDevotion: 50,
    icon: "🦌",
    effect: { type: "speed_boost", value: 1.8, duration: 4000, cooldown: 10000 },
  },
  {
    id: "sunbeam",
    name: "Raio Solar",
    description: "Canaliza a luz de Heliod para curar ferimentos.",
    godId: "heliod",
    requiredDevotion: 25,
    icon: "☀️",
    effect: { type: "heal", value: 30, cooldown: 12000 },
  },
  {
    id: "aegis_light",
    name: "Égide da Luz",
    description: "Um escudo dourado que bloqueia o próximo ataque.",
    godId: "heliod",
    requiredDevotion: 50,
    icon: "🛡️",
    effect: { type: "shield", value: 50, duration: 6000, cooldown: 15000 },
  },
];

export function getBestowsForGod(godId: string): Bestow[] {
  return BESTOWS.filter((b) => b.godId === godId);
}

export function getAvailableBestows(godId: string, devotion: number): Bestow[] {
  return getBestowsForGod(godId).filter((b) => devotion >= b.requiredDevotion);
}
