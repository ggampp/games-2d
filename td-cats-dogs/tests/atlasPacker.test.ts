import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseAtlas,
  packPages,
  toPma,
  regionHasOpaquePixels,
  rotateRgba90Cw,
  createRgba,
} from "../src/spine/atlasPacker.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const sample = `Character1.png
size:128,128
filter:Linear,Linear
pma:true
Body
bounds:83,75,41,46
offsets:4,4,49,54
Gun
bounds:2,2,56,37
offsets:2,2,60,41
Head
bounds:2,49,79,72
offsets:5,6,89,84
`;

const pages = parseAtlas(sample);
assert.equal(pages.length, 1);
assert.equal(pages[0].width, 128);
assert.equal(pages[0].regions.length, 3);
assert.equal(pages[0].regions[0].name, "Body");
assert.equal(pages[0].pma, true);

const packed = packPages(pages);
assert.equal(packed[0].rgba.length, 128 * 128 * 4);
for (const region of pages[0].regions) {
  assert.equal(regionHasOpaquePixels(packed[0], region), true, `${region.name} should have pixels`);
}

const pma = toPma(Uint8Array.from([255, 128, 0, 128]));
assert.equal(pma[0], 128);
assert.equal(pma[3], 128);

const rot = rotateRgba90Cw(createRgba(2, 1, [10, 20, 30, 255]), 2, 1);
assert.equal(rot.width, 1);
assert.equal(rot.height, 2);

const catAtlas = readFileSync(
  join(root, "free-cartoon-cat-defense-game-asset-kit/Json Atlas/Cat Characters/Cat1/Character1.atlas"),
  "utf8",
);
const catPages = parseAtlas(catAtlas);
assert.equal(catPages[0].image, "Character1.png");
assert.equal(catPages[0].regions.map((r) => r.name).join(","), "Body,Gun,Head,Shade,Tails");
const catPacked = packPages(catPages);
assert.equal(catPacked[0].width, 128);
assert.equal(catPacked[0].height, 128);
for (const region of catPages[0].regions) {
  assert.equal(regionHasOpaquePixels(catPacked[0], region), true, region.name);
}

console.log("atlasPacker tests passed");
