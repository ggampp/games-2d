import * as THREE from 'three';
import { loadSpriteSheetFrames, loadSpriteTexture } from './loadSprite';

export type AnimName = 'idle' | 'walk' | 'attack' | 'hurt' | 'down';

export type SpriteAtlas = {
  kind: string;
  frames: Record<AnimName, THREE.Texture[]>;
};

async function loadOptionalSprite(url: string): Promise<THREE.Texture | null> {
  try {
    return await loadSpriteTexture(url);
  } catch {
    return null;
  }
}

/** Try PNG then JPG equal-cell strips. */
async function loadStrip(
  base: string,
  name: string,
  cols: number,
): Promise<THREE.Texture[]> {
  for (const ext of ['png', 'jpg']) {
    try {
      return await loadSpriteSheetFrames(`${base}/${name}.${ext}`, {
        cols,
        equalCells: true,
        keyBackground: ext === 'jpg',
        normalize: false,
        pad: 0,
      });
    } catch {
      // try next
    }
  }
  return [];
}

/**
 * Load character atlas.
 * Hero prefers artist strips: sheet_walk.png (6) + sheet_attack.png (6)
 * with equal cell cuts so every frame has the same pixel size.
 */
export async function loadCharacterAtlas(kind: string): Promise<SpriteAtlas> {
  const base = `/art/${kind}`;

  // Hero strips: 6 frames each (heroi_andando / heroi_atacando)
  const preferCols = kind === 'hero' ? 6 : 4;

  const [down, walkStrip, attackStrip, walkJpg, attackJpg, idleJpg] =
    await Promise.all([
      loadOptionalSprite(`${base}/down.jpg`),
      loadStrip(base, 'sheet_walk', preferCols),
      loadStrip(base, 'sheet_attack', preferCols),
      // legacy 4-col jpg fallbacks
      kind === 'hero'
        ? Promise.resolve([] as THREE.Texture[])
        : loadStrip(base, 'sheet_walk', 4),
      kind === 'hero'
        ? Promise.resolve([] as THREE.Texture[])
        : loadStrip(base, 'sheet_attack', 4),
      loadOptionalSprite(`${base}/idle.jpg`),
    ]);

  let walk = walkStrip.length >= 2 ? walkStrip : walkJpg;
  let attack = attackStrip.length >= 2 ? attackStrip : attackJpg;

  // Idle = first walk frame when using a strip (same scale as walk cycle)
  const idleFromWalk = walk[0] ? [walk[0]] : [];
  const idle = idleFromWalk.length
    ? idleFromWalk
    : idleJpg
      ? [idleJpg]
      : [];

  const rootFallback =
    idle.length > 0
      ? idle
      : await (async () => {
          const t = await loadOptionalSprite(`/art/${kind}.jpg`);
          return t ? [t] : [];
        })();

  if (walk.length === 0) walk = rootFallback;
  if (attack.length === 0) attack = rootFallback;

  const frames: Record<AnimName, THREE.Texture[]> = {
    idle: idle.length ? idle : rootFallback,
    walk,
    attack,
    // Hurt reuses idle (same sheet scale)
    hurt: idle.length ? idle : rootFallback,
    down: down ? [down] : idle.length ? idle : rootFallback,
  };

  for (const key of Object.keys(frames) as AnimName[]) {
    if (frames[key].length === 0) frames[key] = rootFallback;
  }

  return { kind, frames };
}
