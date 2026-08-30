import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";

const names = [
  "cat1.png",
  "cat2.png",
  "cat3.png",
  "zombie-reg1.png",
  "zombie-reg2.png",
  "zombie-boss1.png",
  "battlefield.png",
  "muzzle.png",
  "explosion.png",
  "coin.png",
  "btn-green.png",
  "popup-frame.png",
];

const sources = [
  join(process.cwd(), "assets"),
  "C:\\Users\\ggamp\\.cursor\\projects\\d-claude-projects-dev-games-td-cats-dogs\\assets",
];
const destDir = join(process.cwd(), "public", "generated");
mkdirSync(destDir, { recursive: true });

function keyMagenta(data: Buffer): Buffer {
  const png = PNG.sync.read(data);
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    if (r > 220 && g < 40 && b > 220) {
      png.data[i + 3] = 0;
      png.data[i] = 0;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
    }
  }
  return PNG.sync.write(png);
}

for (const name of names) {
  const src = sources.map((dir) => join(dir, name)).find((p) => existsSync(p));
  if (!src) {
    console.warn(`missing ${name}`);
    continue;
  }
  const dest = join(destDir, name);
  copyFileSync(src, dest);
  writeFileSync(dest, keyMagenta(readFileSync(dest)));
  console.log(`prepared ${dest}`);
}
