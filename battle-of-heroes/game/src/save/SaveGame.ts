const KEY = "boh.save.v1";

export interface SaveData {
  gold: number;
  unlocked: number[];
  party: number[];
  stars: number[];
  barracksLevel: number;
  heroLevels: Record<string, number>;
  music: number;
  sfx: number;
}

const DEFAULT_SAVE: SaveData = {
  gold: 180,
  unlocked: [1, 3, 13, 14, 15],
  party: [14, 1, 15, 13, 3],
  stars: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  barracksLevel: 1,
  heroLevels: {},
  music: 0.45,
  sfx: 0.7,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...structuredClone(DEFAULT_SAVE),
      ...parsed,
      unlocked: parsed.unlocked?.length ? parsed.unlocked : DEFAULT_SAVE.unlocked,
      party: parsed.party?.length ? parsed.party.slice(0, 5) : DEFAULT_SAVE.party,
      stars: parsed.stars?.length === 9 ? parsed.stars : DEFAULT_SAVE.stars,
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(data: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function resetSave(): SaveData {
  const data = structuredClone(DEFAULT_SAVE);
  writeSave(data);
  return data;
}

export function heroLevel(save: SaveData, id: number): number {
  return save.heroLevels[String(id)] ?? 1;
}

export function isStageOpen(save: SaveData, stageId: number): boolean {
  if (stageId <= 1) return true;
  return (save.stars[stageId - 2] ?? 0) > 0;
}
