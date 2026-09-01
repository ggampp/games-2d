export function rollDamage(atk: number, def: number, critChance = 0.08, critMult = 1.6): { damage: number; crit: boolean } {
  const crit = Math.random() < critChance;
  const mitigation = 100 / (100 + Math.max(0, def));
  const variance = 0.9 + Math.random() * 0.2;
  const raw = atk * mitigation * (crit ? critMult : 1) * variance;
  return { damage: Math.max(1, Math.round(raw)), crit };
}
