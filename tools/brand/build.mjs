// Builds the We1ssBoard logo SVGs: the "white shadow" W mark and a monoline
// wordmark drawn as strokes, so no font is needed. Run: node tools/brand/build.mjs
// PNG icons are rendered from these SVGs by frontend/scripts/render-brand.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'media', 'brand');
const INK = '#0b0b0c';
const PAPER = '#ffffff';

// Mark on a 32-unit grid; BrandMark.tsx draws the same geometry.
const W_POINTS = '8.6,10 12.3,22 16,13.4 19.7,22 23.4,10';

function mark(tile, ink, size = 64) {
  const s = size / 32;
  return (
    `<g transform="scale(${s})">` +
    `<rect width="32" height="32" rx="9" fill="${tile}"/>` +
    `<polyline points="${W_POINTS}" transform="translate(1.7 1.7)" fill="none" stroke="${ink}" stroke-opacity="0.35" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<polyline points="${W_POINTS}" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>`
  );
}

// Monoline glyphs: centre-line paths with the baseline at y=0, cap height 30,
// x-height 21; `w` is the centre-line advance before letter spacing.
const glyphs = {
  W: { w: 24, d: 'M0 -30 L6 0 L12 -20 L18 0 L24 -30' },
  e: { w: 17, d: 'M0.5 -10.5 H16.5 A8.25 10.5 0 1 0 14.3 -3.3' },
  1: { w: 6, d: 'M0 -24 L6 -30 V0' },
  s: {
    w: 14,
    d: 'M13.5 -17.5 C12 -20 9.8 -21 7.2 -21 C3.5 -21 1 -19 1 -15.9 C1 -9.8 14 -12.4 14 -5.6 C14 -2.2 11.2 0 7.2 0 C4 0 1.6 -1.3 0 -3.6',
  },
  B: {
    w: 18,
    d: 'M0 0 V-30 H8.8 C13.6 -30 16.4 -27.6 16.4 -23.2 C16.4 -18.8 13.6 -16.2 8.8 -16.2 H0 M8.8 -16.2 H9.6 C15 -16.2 18 -13.4 18 -8.2 C18 -2.9 15 0 9.6 0 H0',
  },
  o: { w: 18, d: 'M0 -10.5 A9 10.5 0 1 0 18 -10.5 A9 10.5 0 1 0 0 -10.5' },
  a: { w: 17, d: 'M17 -10.5 A8.5 10.5 0 1 0 0 -10.5 A8.5 10.5 0 1 0 17 -10.5 M17 -21 V0' },
  r: { w: 10, d: 'M0 0 V-21 M0 -11 C0 -17.6 3.6 -21 10 -21' },
  d: { w: 17, d: 'M17 -10.5 A8.5 10.5 0 1 0 0 -10.5 A8.5 10.5 0 1 0 17 -10.5 M17 -30 V0' },
};

const STROKE = 5;
const SPACING = 8.5;

// The "1" from the nick takes the shadow tone, echoing the mark.
function wordmark(text, x, baseline, ink) {
  let cursor = x;
  const parts = [];
  for (const ch of text) {
    const g = glyphs[ch];
    const tone = ch === '1' ? ` stroke-opacity="0.45"` : '';
    parts.push(`<path transform="translate(${cursor.toFixed(2)} ${baseline})"${tone} d="${g.d}"/>`);
    cursor += g.w + SPACING;
  }
  const g = `<g fill="none" stroke="${ink}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${parts.join('')}</g>`;
  return [g, cursor - SPACING - x];
}

function logo(tile, markInk, ink) {
  const [word, width] = wordmark('We1ssBoard', 84, 47, ink);
  const w = Math.ceil(84 + width + STROKE);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 64" width="${w}" height="64">${mark(tile, markInk)}${word}</svg>\n`;
}

const square = (tile, ink) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${mark(tile, ink)}</svg>\n`;

// Full-bleed app icon (iOS masks the corners itself) and a bare W for Android adaptive
// icons, scaled into the 66/108 safe zone.
const wStrokes = (ink) =>
  `<g fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">` +
  `<polyline points="${W_POINTS}" transform="translate(1.7 1.7)" stroke-opacity="0.35"/>` +
  `<polyline points="${W_POINTS}"/></g>`;
const appIcon =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="1024" height="1024">` +
  `<rect width="32" height="32" fill="${INK}"/>` +
  `<g transform="translate(16 16) scale(1.15) translate(-16 -16)">${wStrokes(PAPER)}</g></svg>\n`;
const glyph =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="1024" height="1024">` +
  `<g transform="translate(54 54) scale(2.6) translate(-16.85 -16.85)">${wStrokes(PAPER)}</g></svg>\n`;

const files = {
  'we1ssboard-app-icon.svg': appIcon,
  'we1ssboard-glyph.svg': glyph,
  'we1ssboard-mark.svg': square(INK, PAPER),
  'we1ssboard-mark-inverse.svg': square(PAPER, INK),
  'we1ssboard-logo-light.svg': logo(INK, PAPER, INK),
  'we1ssboard-logo-dark.svg': logo(PAPER, INK, PAPER),
};
mkdirSync(out, { recursive: true });
for (const [name, svg] of Object.entries(files)) writeFileSync(join(out, name), svg);
console.error(`wrote ${Object.keys(files).join(', ')} to ${out}`);
