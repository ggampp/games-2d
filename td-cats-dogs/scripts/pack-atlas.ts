import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { PNG } from "pngjs";
import { parseAtlas, packPages, type AtlasRegion, type AtlasPage } from "../src/spine/atlasPacker.ts";

const KIT = join(process.cwd(), "free-cartoon-cat-defense-game-asset-kit", "Json Atlas");
const PARTS = join(process.cwd(), "generated", "parts");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (entry.endsWith(".atlas")) acc.push(full);
  }
  return acc;
}

function loadPng(path: string): { rgba: Uint8Array; width: number; height: number } {
  const png = PNG.sync.read(readFileSync(path));
  return { rgba: Uint8Array.from(png.data), width: png.width, height: png.height };
}

function writePng(path: string, width: number, height: number, rgba: Uint8Array): void {
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
}

function partPath(atlasFile: string, region: AtlasRegion): string {
  const folder = dirname(atlasFile).replace(KIT, PARTS);
  return join(folder, `${region.name}.png`);
}

const targets = process.argv.slice(2);
const files = walk(KIT).filter((file) => {
  if (targets.length === 0) return true;
  const norm = file.replace(/\\/g, "/");
  return targets.some((t) => norm.includes(t.replace(/\\/g, "/")));
});

for (const atlasFile of files) {
  const pages = parseAtlas(readFileSync(atlasFile, "utf8"));
  const packed = packPages(pages, (_page: AtlasPage, region: AtlasRegion) => {
    const custom = partPath(atlasFile, region);
    if (!existsSync(custom)) return null;
    return loadPng(custom);
  });
  for (const page of packed) {
    const out = join(dirname(atlasFile), page.image);
    writePng(out, page.width, page.height, page.rgba);
    console.log(`packed ${out} (${page.width}x${page.height}, pma=${page.pma})`);
  }
}
