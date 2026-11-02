// Checks the pixel-art display rules on the real page, at several screen sizes and
// device pixel ratios:
//   - the 256×144 frame is drawn at a whole-number scale,
//   - every frame pixel is a uniform s×s block on screen (one pixel size for
//     everything: sprites, effects, HUD, text),
//   - the rest of the canvas is pure black,
//   - the canvas backing store matches the device pixels (no browser resampling).
//
// Usage (needs Playwright with Chromium):  node tools/pixel-check.js [--vitrine]

'use strict';

const path = require('path');
const { chromium } = require('playwright');

const CASES = [
  // [css width, css height, device pixel ratio]
  [1280, 720, 1], [1366, 768, 1], [1920, 1080, 1], [1440, 900, 2],
  [1536, 864, 1.25], [800, 600, 1.5], [390, 844, 3], [412, 915, 2.625], [844, 390, 3],
];

async function check(browser, [w, h, dpr], query) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + query);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const c = document.getElementById('stage');
    const { s, ox, oy } = view;
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const at = (x, y) => { const i = (y * c.width + x) * 4; return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; };
    let mixed = 0;
    let notBlack = 0;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const u = Math.floor((x - ox) / s);
        const v = Math.floor((y - oy) / s);
        if (u < 0 || v < 0 || u >= 256 || v >= 144) { if (at(x, y) !== 0) notBlack++; continue; }
        // Compare with the top-left device pixel of the same frame pixel (when on screen).
        const x0 = Math.max(0, ox + u * s);
        const y0 = Math.max(0, oy + v * s);
        if (at(x, y) !== at(x0, y0)) mixed++;
      }
    }
    const rect = c.getBoundingClientRect();
    return {
      s, canvas: [c.width, c.height], css: [rect.width, rect.height],
      backingOk: Math.abs(c.width - rect.width * devicePixelRatio) < 1 && Math.abs(c.height - rect.height * devicePixelRatio) < 1,
      mixed, notBlack,
    };
  });
  await page.close();
  const ok = Number.isInteger(r.s) && r.s >= 1 && r.mixed === 0 && r.notBlack === 0 && r.backingOk && !errors.length;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${w}x${h} @${dpr}  scale ${r.s}x  canvas ${r.canvas.join('x')}  mixed blocks ${r.mixed}  non-black bars ${r.notBlack}  backing ${r.backingOk ? 'ok' : 'resampled'}${errors.length ? '  errors: ' + errors.join('; ') : ''}`);
  return ok;
}

(async () => {
  const query = process.argv.includes('--vitrine') ? '?vitrine' : '';
  const browser = await chromium.launch();
  let ok = true;
  for (const c of CASES) ok = (await check(browser, c, query)) && ok;
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
