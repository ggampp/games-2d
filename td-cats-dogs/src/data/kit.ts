export function kitUrl(...parts: string[]): string {
  return `/kit/Png/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export type FrameRef = { key: string; url: string };

export function catIdleFrames(id: number): FrameRef[] {
  return Array.from({ length: 20 }, (_, i) => ({
    key: `c${id}-idle-${i}`,
    url: kitUrl("Characters", `C${id}`, "Idle", `Character${id}-Idle_${pad2(i)}.png`),
  }));
}

export function catShootFrames(id: number): FrameRef[] {
  return Array.from({ length: 10 }, (_, i) => ({
    key: `c${id}-shoot-${i}`,
    url: kitUrl("Characters", `C${id}`, "Shoot", `Character${id}-Shoot_${pad2(i)}.png`),
  }));
}

export function enemyWalkFrames(folder: string, filePrefix: string, count = 35): FrameRef[] {
  const tag = folder.replace(/\s+/g, "-").toLowerCase();
  return Array.from({ length: count }, (_, i) => ({
    key: `${tag}-walk-${i}`,
    url: kitUrl("Enemies", folder, "Walk", `${filePrefix}_${pad2(i)}.png`),
  }));
}

export function fxFrames(folder: string, file: string, count: number, key: string): FrameRef[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `${key}-${i}`,
    url: kitUrl(folder, `${file}_${pad2(i)}.png`),
  }));
}

export const UI = {
  area: kitUrl("Area", "Area1.png"),
  landing: kitUrl("Ui", "LandingScreen.png"),
  logo: kitUrl("Ui", "Logo.png"),
  coin: kitUrl("Ui", "CoinIcon.png"),
  coinBar: kitUrl("Ui", "CoinBar.png"),
  waveBar: kitUrl("Ui", "WaveBar.png"),
  btnGreen: kitUrl("Ui", "BtnGreen.png"),
  btnOrange: kitUrl("Ui", "BtnOrange.png"),
  win: kitUrl("Ui", "WinPopUp.png"),
  lose: kitUrl("Ui", "LosePopUp.png"),
  catIcon: kitUrl("Ui", "Icon_Cat.png"),
  wallIcon: kitUrl("Ui", "WallIcon.png"),
  settings: kitUrl("Ui", "SettingBtn.png"),
  bullet: kitUrl("Bullets", "Artboard 1.png"),
};

export const SLICE_CATS = [1, 2, 3] as const;

export function allSliceFrames(): FrameRef[] {
  return [
    ...SLICE_CATS.flatMap((id) => [...catIdleFrames(id), ...catShootFrames(id)]),
    ...enemyWalkFrames("Enemy Reg 1", "Enemy-Walking"),
    ...enemyWalkFrames("Enemy Reg 2", "Enemy-Walking"),
    ...enemyWalkFrames("Enemy Boss 1", "Enemy-Walk"),
    ...fxFrames("ShootFx", "Fx2-animation", 15, "muzzle"),
    ...fxFrames("Explosion", "ExplosionFx-Explossion", 20, "boom"),
  ];
}
