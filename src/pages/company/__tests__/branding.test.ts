/**
 * Branding contrast guard. Light: a brand color too light for white text is
 * darkened (lightness only) until it reaches 4.5:1 on white. Dark: a lighter
 * version of the brand hue reaches 7:1 on the dark card and 4.5:1 on every
 * dark surface.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ACCENT_PRESETS,
  BRANDING_STYLE_ID,
  DARK_BRAND_TARGET,
  DARK_SURFACES,
  LIGHT_SURFACES,
  MIN_BRAND_CONTRAST,
  applyCompanyBranding,
  brandingCss,
  brandingVars,
  contrast,
  contrastOnWhite,
  ensureContrastOnWhite,
  hexToHsl,
  hslToHex,
  type Hsl,
} from '../branding';

describe('contrastOnWhite', () => {
  it('matches the WCAG ratios in DESIGN.md', () => {
    expect(contrastOnWhite(hexToHsl('#000000')!)).toBeCloseTo(21, 1);
    expect(contrastOnWhite(hexToHsl('#ffffff')!)).toBeCloseTo(1, 5);
    // ASM indigo #2E2F70 is listed as 11.95:1 (hexToHsl rounds to whole numbers).
    expect(contrastOnWhite(hexToHsl('#2E2F70')!)).toBeCloseTo(11.95, 0);
  });
});

describe('ensureContrastOnWhite', () => {
  it('leaves a color that already passes unchanged', () => {
    const indigo = hexToHsl('#2E2F70')!;
    expect(ensureContrastOnWhite(indigo)).toEqual(indigo);
  });

  it('darkens a light color step by step until it passes, keeping hue and saturation', () => {
    const yellow = hexToHsl('#facc15')!; // ~1.5:1 on white
    expect(contrastOnWhite(yellow)).toBeLessThan(MIN_BRAND_CONTRAST);
    const fixed = ensureContrastOnWhite(yellow);
    expect(contrastOnWhite(fixed)).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    expect(fixed.h).toBe(yellow.h);
    expect(fixed.s).toBe(yellow.s);
    expect(fixed.l).toBeLessThan(yellow.l);
    // Smallest change: one step lighter would fail again.
    expect(contrastOnWhite({ ...fixed, l: fixed.l + 1 })).toBeLessThan(MIN_BRAND_CONTRAST);
  });

  it('fixes white and every preset swatch', () => {
    for (const hex of ['#ffffff', '#e09f1f', ...ACCENT_PRESETS.map((p) => p.hex)]) {
      expect(contrastOnWhite(ensureContrastOnWhite(hexToHsl(hex)!))).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    }
  });
});

describe('hslToHex', () => {
  it('round-trips through hexToHsl within rounding', () => {
    const hsl = hexToHsl('#0f766e')!;
    expect(hexToHsl(hslToHex(hsl))).toEqual(hsl);
  });
});

/** Read an HSL-triplet token ("228 21.1% 13.9%") from a block of src/index.css. */
function cssToken(block: ':root' | '.dark', name: string): Hsl {
  const css = readFileSync(join(__dirname, '../../../index.css'), 'utf-8');
  const start = css.indexOf(block === ':root' ? '.theme-light {' : '.dark {');
  const body = css.slice(start, css.indexOf('}', start));
  const m = body.match(new RegExp(`--${name}:\\s*([\\d.]+) ([\\d.]+)% ([\\d.]+)%`));
  if (!m) throw new Error(`no --${name} in ${block}`);
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

/** Parse a written variable back: an HSL triplet or a hex. */
function parseVar(v: string): Hsl {
  if (v.startsWith('#')) return hexToHsl(v)!;
  const [h, s, l] = v.replace(/^hsl\(|\)$/g, '').split(' ').map((p) => parseFloat(p));
  return { h: h!, s: s!, l: l! };
}

// ASM indigo, the three other seed tenants (src/lib/tenants.ts), and two
// colors that are too light for white text.
const SAMPLES = ['#2E2F70', '#4d7c0f', '#0f766e', '#9a3412', '#facc15', '#ffffff', ...ACCENT_PRESETS.map((p) => p.hex)];

describe('LIGHT_SURFACES / DARK_SURFACES', () => {
  it('match the :root and .dark tokens in src/index.css', () => {
    for (const [name, hex] of Object.entries(LIGHT_SURFACES)) {
      expect(contrast(hexToHsl(hex)!, cssToken(':root', name)), name).toBeLessThan(1.03);
    }
    for (const [name, hex] of Object.entries(DARK_SURFACES)) {
      expect(contrast(hexToHsl(hex)!, cssToken('.dark', name)), name).toBeLessThan(1.03);
    }
  });
});

describe('brandingVars, light theme', () => {
  it.each(SAMPLES)('%s: brand text and buttons reach 4.5:1 on every light surface', (hex) => {
    const v = brandingVars(hex)!.light;
    const primary = parseVar(v['--primary']!);
    for (const [name, surface] of Object.entries(LIGHT_SURFACES)) {
      expect(contrast(primary, hexToHsl(surface)!), name).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    }
    expect(contrast(primary, parseVar(v['--primary-foreground']!))).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    expect(contrast(parseVar(v['--accent-foreground']!), parseVar(v['--accent']!))).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    expect(contrast(primary, parseVar(v['--accent']!))).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    expect(v['--company-accent']).toBe(hslToHex(primary));
  });
});

describe('brandingVars, dark theme', () => {
  it.each(SAMPLES)('%s: a lighter brand color, 7:1 on the card and 4.5:1 on every dark surface', (hex) => {
    const v = brandingVars(hex)!.dark;
    const primary = parseVar(v['--primary']!);
    expect(primary.l).toBeGreaterThan(hexToHsl(DARK_SURFACES.card!)!.l + 40);
    expect(contrast(primary, hexToHsl(DARK_SURFACES.card!)!)).toBeGreaterThanOrEqual(DARK_BRAND_TARGET);
    for (const [name, surface] of Object.entries(DARK_SURFACES)) {
      expect(contrast(primary, hexToHsl(surface)!), name).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    }
    // Dark text on the light brand button, text on the dark tint, brand text on the tint.
    expect(contrast(primary, parseVar(v['--primary-foreground']!))).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    const tint = parseVar(v['--accent']!);
    expect(contrast(parseVar(v['--accent-foreground']!), tint)).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    expect(contrast(primary, tint)).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    // The tint is a dark surface: light theme text would not show on it.
    expect(tint.l).toBeLessThan(30);
    // Hue kept, so the brand still looks like itself.
    expect(primary.h).toBe(hexToHsl(hex)!.h);
  });

  it('gives ASM indigo a light indigo close to the theme default #A9ABF2', () => {
    const primary = parseVar(brandingVars('#2E2F70')!.dark['--primary']!);
    expect(contrast(primary, cssToken('.dark', 'primary'))).toBeLessThan(1.25);
  });
});

describe('brandingCss', () => {
  it('writes the light set on html:root and the dark set on html.dark:root', () => {
    const css = brandingCss(brandingVars('#0f766e')!);
    const [light, dark] = css.split('html.dark:root');
    expect(light).toMatch(/^html:root \{/);
    expect(light).toContain('--primary-foreground: 0 0% 100%;');
    expect(dark).toContain(`--primary: ${brandingVars('#0f766e')!.dark['--primary']};`);
    expect(css).not.toContain('--ring');
  });
});

describe('applyCompanyBranding', () => {
  const realDocument = globalThis.document;
  let style: { id: string; textContent: string } | null;

  beforeEach(() => {
    style = null;
    Object.defineProperty(globalThis, 'document', {
      value: {
        getElementById: (id: string) => (style && style.id === id ? style : null),
        createElement: () => ({ id: '', textContent: '' }),
        head: { appendChild: (el: { id: string; textContent: string }) => (style = el) },
      },
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    Object.defineProperty(globalThis, 'document', { value: realDocument, configurable: true, writable: true });
  });

  it('writes one style element, reused on the next call', () => {
    applyCompanyBranding({ logoText: 'X', accentColor: '#facc15' });
    expect(style?.id).toBe(BRANDING_STYLE_ID);
    expect(style?.textContent).not.toContain('#facc15');
    const first = style;
    applyCompanyBranding({ logoText: 'X', accentColor: '#0f766e' });
    expect(style).toBe(first);
    expect(style?.textContent).toBe(brandingCss(brandingVars('#0f766e')!));
  });

  it('does not touch the amber focus ring', () => {
    applyCompanyBranding({ logoText: 'X', accentColor: '#0f766e' });
    expect(style?.textContent).not.toMatch(/--(sidebar-)?ring/);
  });

  it('ignores an invalid color', () => {
    applyCompanyBranding({ logoText: 'X', accentColor: 'not-a-color' });
    expect(style).toBeNull();
  });
});
