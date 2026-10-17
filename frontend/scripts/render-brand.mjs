// Renders PNG icons from media/brand/*.svg with Playwright's Chromium.
// Run from frontend/: node scripts/render-brand.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const svg = (name) => readFileSync(join(root, 'media', 'brand', name), 'utf8');

// [svg, css size, background, output path]
const jobs = [];
for (const px of [16, 24, 32, 64, 192, 512]) {
  jobs.push(['fullboard-mark.svg', px, px, 'transparent', `frontend/public/icons/fullboard-${px}.png`]);
}
jobs.push(['fullboard-mark.svg', 256, 256, 'transparent', 'docs/public/favicon.png']);
jobs.push(['fullboard-mark.svg', 512, 512, 'transparent', 'docs/public/icon.png']);
jobs.push(['fullboard-logo-light.svg', null, 128, 'transparent', 'media/brand/fullboard-logo-light.png']);
jobs.push(['fullboard-logo-dark.svg', null, 128, 'transparent', 'media/brand/fullboard-logo-dark.png']);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await browser.newPage();
for (const [name, w, h, bg, out] of jobs) {
  const markup = svg(name);
  const [vw, vh] = markup.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
  const width = w ?? Math.round((h * vw) / vh);
  await page.setViewportSize({ width, height: h });
  await page.setContent(
    `<html><body style="margin:0;background:${bg}">${markup.replace('<svg ', `<svg style="display:block;width:${width}px;height:${h}px" `)}</body></html>`,
  );
  mkdirSync(dirname(join(root, out)), { recursive: true });
  await page.screenshot({ path: join(root, out), omitBackground: true });
}
await browser.close();
console.log(`rendered ${jobs.length} images`);
