// WCAG 2 contrast check for the theme tokens in src/index.css (:root / .theme-light
// and .dark).
// Usage: node scripts/check-contrast.mjs
// Main text needs 7:1, other text 4.5:1; control borders, chart colours,
// gridlines and focus rings 3:1. Exits 1 if any fail.
// The focus ring is two-tone (ink inside, amber outside); each focus row checks
// the ring that carries the contrast on that surface.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

function readBlock(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`block ${selector} not found`);
  const body = css.slice(start, css.indexOf('}', start));
  const vars = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)) {
    vars[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return vars;
}

function hslToRgb([h, s, l]) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function luminance(hsl) {
  const [r, g, b] = hslToRgb(hsl).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground token, background token, kind]
// main = body text (7:1), text = other text (4.5:1), border / chart = 3:1.
const SURFACES = ['background', 'card', 'muted', 'secondary', 'accent', 'success-soft', 'warning-soft', 'danger-soft'];
const PAIRS = [
  // Main text.
  ['foreground', 'background', 'main'],
  ['card-foreground', 'card', 'main'],
  ['popover-foreground', 'popover', 'main'],
  // Body text, muted text (also placeholders and disabled text), links and
  // status text on every surface, including the soft boxes and hover rows.
  ...SURFACES.filter((s) => s !== 'background' && s !== 'card').map((s) => ['foreground', s, 'text']),
  ...SURFACES.map((s) => ['muted-foreground', s, 'text']),
  ...SURFACES.map((s) => ['primary', s, 'text']),
  ['success', 'background', 'text'],
  ['success', 'card', 'text'],
  ['success', 'muted', 'text'],
  ['success', 'success-soft', 'text'],
  ['warning', 'background', 'text'],
  ['warning', 'card', 'text'],
  ['warning', 'muted', 'text'],
  ['warning', 'warning-soft', 'text'],
  ['destructive', 'background', 'text'],
  ['destructive', 'card', 'text'],
  ['destructive', 'muted', 'text'],
  ['destructive', 'danger-soft', 'text'],
  ['accent-foreground', 'accent', 'text'],
  ['secondary-foreground', 'secondary', 'text'],
  // Text on filled buttons, chips and dots.
  ['primary-foreground', 'primary', 'text'],
  ['destructive-foreground', 'destructive', 'text'],
  ['success-foreground', 'success', 'text'],
  ['warning-foreground', 'warning', 'text'],
  ['help-foreground', 'help', 'text'],
  // Inverted: tooltips (background on foreground), grey chips.
  ['background', 'foreground', 'text'],
  ['background', 'muted-foreground', 'text'],
  ['sidebar-foreground', 'sidebar-background', 'text'],
  ['sidebar-primary-foreground', 'sidebar-primary', 'text'],
  ['sidebar-accent-foreground', 'sidebar-accent', 'text'],
  // Control borders (also the dashed border of disabled controls).
  ['input', 'card', 'border'],
  ['input', 'background', 'border'],
  ['input', 'muted', 'border'],
  // Chart colours and gridlines.
  ...['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'chart-7', 'chart-grid'].flatMap((c) => [
    [c, 'card', 'chart'],
    [c, 'background', 'chart'],
  ]),
  // Series names written on bars in the card colour (chartText barNameLabel).
  ...['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6'].map((c) => ['card', c, 'text']),
];
// Header band, Help and main-action buttons, two-tone icons on their circles,
// count badges (the ASM app style).
const APP_PAIRS = [
  ['bar-foreground', 'bar', 'main'],
  ['bar-subtle', 'bar', 'text'], // company name; also the avatar circle's edge
  ['bar', 'bar-subtle', 'text'], // avatar initials
  ['help-foreground', 'help', 'main'],
  ['help', 'bar', 'border'], // the Help button's edge on the band
  ['cta-foreground', 'cta', 'main'],
  ['icon-main', 'tile', 'border'], // icon outline on its circle
  ['count-foreground', 'count', 'text'],
  ['count', 'tile', 'border'], // count badge edge on the circle
  ['foreground', 'tile', 'main'],
];
// Focus rows per theme: [ring token, surface token]. Light: the ink ring on
// white, the amber ring on the band and indigo, the ink ring on amber buttons.
// Dark: the amber ring on the dark surfaces, the ink ring on light fills.
const FOCUS = {
  light: [['ring-inner', 'card'], ['ring-inner', 'background'], ['ring', 'bar'], ['ring', 'primary'], ['ring-inner', 'cta']],
  dark: [['ring', 'card'], ['ring', 'background'], ['ring', 'bar'], ['ring-inner', 'primary'], ['ring-inner', 'cta']],
};
const MIN = { main: 7, text: 4.5, border: 3, chart: 3, focus: 3 };

const light = readBlock('.theme-light');
const dark = { ...light, ...readBlock('.dark') };
// Amber buttons need their #8A4A14 edge on white (amber is 1.88:1 there); on
// the dark page the amber fill itself is the edge.
const THEMES = [
  ['light', '.theme-light', light, [...APP_PAIRS, ['cta-border', 'background', 'border']]],
  ['dark', '.dark', dark, [...APP_PAIRS, ['cta', 'background', 'border']]],
];

let failures = 0;
let checked = 0;
for (const [name, selector, t, extra] of THEMES) {
  console.log(`\n== ${name} (${selector})`);
  const rows = [...PAIRS, ...extra, ...FOCUS[name].map(([fg, bg]) => [fg, bg, 'focus'])];
  for (const [fg, bg, kind] of rows) {
    if (!t[fg] || !t[bg]) {
      console.log(`  MISSING  --${fg} / --${bg}`);
      failures++;
      continue;
    }
    checked++;
    const r = ratio(t[fg], t[bg]);
    const ok = r >= MIN[kind];
    if (!ok) failures++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (min ${MIN[kind]})  ${kind.padEnd(6)}  --${fg} on --${bg}`);
  }
}

console.log(`\n${checked} pair(s) checked, ${failures} failing pair(s).`);
process.exit(failures ? 1 : 0);
