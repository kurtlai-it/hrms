// Locale completeness check for src/i18n/locales.
// Usage: node scripts/check-i18n-keys.mjs
// Lists every key in en.json that is missing from ms.json or zh.json, and any
// translation whose {{placeholders}} differ from English. Exits 1 on either.
import { readFileSync } from 'node:fs';

const load = (lang) =>
  JSON.parse(readFileSync(new URL(`../src/i18n/locales/${lang}.json`, import.meta.url), 'utf8'));

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

const placeholders = (s) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');

const en = flatten(load('en'));
console.log(`en.json: ${Object.keys(en).length} keys`);

let problems = 0;
for (const lang of ['ms', 'zh']) {
  const other = flatten(load(lang));
  const missing = Object.keys(en).filter((k) => !(k in other));
  const extra = Object.keys(other).filter((k) => !(k in en));
  const badVars = Object.keys(en).filter((k) => k in other && placeholders(en[k]) !== placeholders(other[k]));
  console.log(`\n${lang}.json: ${Object.keys(other).length} keys, ${missing.length} missing, ${badVars.length} placeholder mismatch(es), ${extra.length} extra`);
  for (const k of missing) console.log(`  MISSING      ${k}`);
  for (const k of badVars) console.log(`  PLACEHOLDER  ${k}: en {${placeholders(en[k])}} vs ${lang} {${placeholders(other[k])}}`);
  for (const k of extra) console.log(`  EXTRA        ${k}`);
  problems += missing.length + badVars.length;
}
console.log(`\n${problems} problem(s).`);
process.exit(problems ? 1 : 0);
