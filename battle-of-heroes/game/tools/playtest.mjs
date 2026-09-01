import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "qa");
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 120000 });
await page.waitForSelector("canvas", { timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: join(dir, "01-menu.png") });

const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas");
const click = async (x, y) => {
  await page.mouse.click(box.x + x, box.y + y);
};

await click(470, 338);
await page.waitForTimeout(800);
await page.screenshot({ path: join(dir, "02-map.png") });

await click(1280 * 0.13, 720 * 0.7);
await page.waitForTimeout(2000);
await page.screenshot({ path: join(dir, "03-battle.png") });

for (let i = 0; i < 8; i++) {
  await click(640 + (i % 5 - 2) * 118, 662);
  await page.waitForTimeout(350);
}
await page.waitForTimeout(4000);
await page.screenshot({ path: join(dir, "04-combat.png") });

await click(24, 18);
await page.waitForTimeout(600);
await click(90, 40);
await page.waitForTimeout(500);
await click(810, 338);
await page.waitForTimeout(800);
await page.screenshot({ path: join(dir, "05-heroes.png") });

await click(90, 36);
await page.waitForTimeout(400);
await click(470, 488);
await page.waitForTimeout(800);
await page.screenshot({ path: join(dir, "06-shop.png") });

const pixels = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  if (!c) return { empty: true };
  const ctx = c.getContext("2d") || c.getContext("webgl") || c.getContext("webgl2");
  return {
    w: c.width,
    h: c.height,
    webgl: !!(c.getContext("webgl") || c.getContext("webgl2")),
  };
});

console.log(JSON.stringify({ errors, pixels }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 2;
