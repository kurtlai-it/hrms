/**
 * Tenant colour on the band, the icon tone and links (Prompt 7 Part 5), for
 * the ASM indigo and every seeded tenant colour, in both themes:
 *   white text on --bar        7:1 or more
 *   --bar-subtle on --bar      4.5:1 or more
 *   --icon-main on --tile      3:1 or more
 *   links (--primary) on the card: 4.5:1 light, 7:1 dark
 * Amber (--cta, --help, --ring) is never written by the tenant colour.
 */
import { describe, expect, it } from 'vitest';
import {
  BAND_TARGET,
  DARK_BRAND_TARGET,
  DARK_SURFACES,
  ICON_TARGET,
  LIGHT_SURFACES,
  MIN_BRAND_CONTRAST,
  brandBandHex,
  brandingVars,
  contrast,
  contrastOnWhite,
  hexToHsl,
  type Hsl,
} from '../branding';
import { demoCompanyRecords } from '@/lib/tenants';

const fromVar = (v: string): Hsl => {
  const [h, s, l] = v.replace(/%/g, '').split(' ').map(Number);
  return { h: h!, s: s!, l: l! };
};
const WHITE: Hsl = { h: 0, s: 0, l: 100 };

const COLOURS = ['#2E2F70', '#4d7c0f', '#0f766e', '#9a3412'];

describe('tenant colour: band, icons and links', () => {
  it('covers every seeded tenant colour', () => {
    for (const c of demoCompanyRecords()) expect(COLOURS.map((x) => x.toLowerCase())).toContain(c.branding.accentColor.toLowerCase());
  });

  for (const hex of COLOURS) {
    for (const theme of ['light', 'dark'] as const) {
      it(`${hex} ${theme}`, () => {
        const v = brandingVars(hex)![theme];
        const bar = fromVar(v['--bar']!);
        const card = hexToHsl(theme === 'light' ? LIGHT_SURFACES.card! : DARK_SURFACES.card!)!;
        const white = contrast(WHITE, bar);
        const subtle = contrast(fromVar(v['--bar-subtle']!), bar);
        const icon = contrast(fromVar(v['--icon-main']!), fromVar(v['--tile']!));
        const link = contrast(fromVar(v['--primary']!), card);
        console.log(`${hex} ${theme}: white on band ${white.toFixed(2)}:1, company name on band ${subtle.toFixed(2)}:1, icon on circle ${icon.toFixed(2)}:1, link on card ${link.toFixed(2)}:1`);
        expect(white).toBeGreaterThanOrEqual(BAND_TARGET);
        expect(subtle).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
        expect(icon).toBeGreaterThanOrEqual(ICON_TARGET);
        expect(link).toBeGreaterThanOrEqual(theme === 'light' ? MIN_BRAND_CONTRAST : DARK_BRAND_TARGET);
        // Amber stays the same for every tenant.
        for (const k of ['--cta', '--cta-border', '--help', '--help-border', '--ring', '--icon-accent']) expect(v[k]).toBeUndefined();
        // Dark mode has its own band and icon values.
        if (theme === 'dark') {
          const light = brandingVars(hex)!.light;
          expect(v['--bar']).not.toBe(light['--bar']);
          expect(v['--icon-main']).not.toBe(light['--icon-main']);
        }
      });
    }
  }

  it('darkens a pale tenant colour until white text on the band has 7:1', () => {
    const v = brandingVars('#facc15')!;
    expect(contrast(WHITE, fromVar(v.light['--bar']!))).toBeGreaterThanOrEqual(BAND_TARGET);
    expect(contrast(WHITE, fromVar(v.dark['--bar']!))).toBeGreaterThanOrEqual(BAND_TARGET);
    expect(contrastOnWhite(hexToHsl(brandBandHex('#facc15'))!)).toBeGreaterThanOrEqual(BAND_TARGET - 0.1);
  });

  it('the ASM indigo band keeps its colour', () => {
    expect(brandBandHex('#2E2F70').toLowerCase()).toBe('#2e2f70');
    expect(brandBandHex(undefined).toLowerCase()).toBe('#2e2f70');
  });
});
