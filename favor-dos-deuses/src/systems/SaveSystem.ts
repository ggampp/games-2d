import { SAVE_KEY } from "../data/constants";

export interface SaveData {
  version: 1;
  devotion: string; // DevotionSystem.serialize()
  equipped: string[]; // ids das bênçãos por slot ("" = vazio)
  playerHp: number;
  bargained: boolean;
  savedAt: number;
}

export const SaveSystem = {
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.version !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  save(data: Omit<SaveData, "version" | "savedAt">): void {
    try {
      const full: SaveData = { version: 1, savedAt: Date.now(), ...data };
      localStorage.setItem(SAVE_KEY, JSON.stringify(full));
    } catch {
      /* storage indisponível (modo privado etc.) — jogo continua sem save */
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  },

  exists(): boolean {
    return this.load() !== null;
  },
};
