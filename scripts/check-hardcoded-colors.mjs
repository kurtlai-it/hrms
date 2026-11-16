// Hard-coded colour check for src (part of `npm run lint`).
// Usage: node scripts/check-hardcoded-colors.mjs
// Screen colours must come from the theme tokens in src/index.css (they have
// light and dark values and pass scripts/check-contrast.mjs). Flags:
//   - Tailwind palette classes (text-red-700, bg-stone-100, text-white, ...),
//     with any variant (hover:, dark:, !)
//   - arbitrary colour classes (bg-[#fff], text-[rgb(...)])
//   - colour literals in style / SVG / chart props (fill="#...", color: '#...')
//   - dark: colour variants (dark:bg-..., dark:text-...): every token already
//     has a dark value, so an override only fights it
// A line is allowed when it, or the line above, has a `colors-ok: <reason>`
// comment, or the file is in ALLOWED_FILES. Exits 1 on any finding.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Files whose colours are not the screen theme (listed with the reason). */
export const ALLOWED_FILES = {
  'src/lib/payrollReportPdf.ts': 'PDF output (print colours)',
  'src/lib/salaryReportPdf.ts': 'PDF output (print colours)',
  'src/pages/superadmin/invoicePdf.ts': 'PDF output (print colours)',
  'src/lib/tenants.ts': 'seed data: tenant brand colours',
  'src/lib/orgChart.ts': 'data: department colour palette',
  'src/pages/company/branding.ts': 'turns tenant colours into theme variables',
  'src/lib/ocr.ts': 'canvas pre-processing for OCR, not shown on screen',
};

const HUES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PROPS =
  'text|bg|border(?:-[trblxyse])?|ring(?:-offset)?|fill|stroke|from|via|to|divide|outline|decoration|placeholder|caret|accent|shadow';
const VARIANTS = String.raw`(?:[\w\-\[\]=&/.*>]+:)*!?`;
const PALETTE = new RegExp(
  String.raw`(?<![\w-])${VARIANTS}(?:${PROPS})-(?:(?:${HUES})-\d{2,3}|white|black)(?:/\d+)?(?![\w-])`,
  'g',
);
// bg-black/NN is a modal scrim: dark in both themes on purpose.
const SCRIM = /(?<![\w-])bg-black\/\d+(?![\w-])/;
const ARBITRARY = new RegExp(String.raw`(?<![\w-])${VARIANTS}(?:${PROPS})-\[(?:#|rgba?\(|hsla?\((?!var))[^\]]*\]`, 'g');
const DARK_VARIANT = new RegExp(String.raw`(?<![\w-])(?:[\w\-\[\]=&/.*>]+:)*dark:${VARIANTS}(?:${PROPS})-[\w/.\-\[\]%()]+`, 'g');
const PROP_LITERAL =
  /\b(?:color|background|backgroundColor|borderColor|outlineColor|fill|stroke|stopColor|floodColor|maskColor|fillStyle|strokeStyle)\s*[:=]\s*\{?\s*['"`](?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\((?!var)|white|black)/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);
const findings = [];
let files = 0;
for (const abs of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, abs).split(sep).join('/');
  if (rel.includes('/__tests__/') || /\.test\.tsx?$/.test(rel) || rel.startsWith('src/test/')) continue;
  if (rel in ALLOWED_FILES) continue;
  files++;
  const lines = readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (isComment(line)) return;
    if (/colors-ok:/.test(line) || /colors-ok:/.test(lines[i - 1] ?? '')) return;
    const hits = [
      ...[...line.matchAll(PALETTE)].map((m) => m[0]).filter((t) => !SCRIM.test(t)),
      ...[...line.matchAll(ARBITRARY)].map((m) => m[0]),
      ...[...line.matchAll(DARK_VARIANT)].map((m) => m[0]),
      ...[...line.matchAll(PROP_LITERAL)].map((m) => m[0]),
    ];
    for (const hit of hits) findings.push(`${rel}:${i + 1}  ${hit}`);
  });
}

console.log(`Checked ${files} files for hard-coded colours (theme tokens only).`);
console.log('Allowed files (not screen theme):');
for (const [f, why] of Object.entries(ALLOWED_FILES)) console.log(`  ${f}: ${why}`);
if (findings.length) {
  console.log(`\n${findings.length} hard-coded colour(s). Use a token from src/index.css, or add a "colors-ok: <reason>" comment:`);
  for (const f of findings) console.log(`  ${f}`);
  process.exit(1);
}
console.log('\n0 hard-coded colours.');
