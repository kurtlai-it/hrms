/**
 * Company branding — applies the ACTIVE company's `branding` to the app at
 * runtime. Mounted once in AppLayout (useCompanyBranding).
 *
 * The variables go into one <style id="company-branding"> element with a
 * light rule and a dark rule, so dark mode gets its own brand values (inline
 * styles on <html> would beat the `.dark` tokens in index.css).
 *
 * Variables written, per theme (see brandingVars):
 *   --company-accent            accent hex after the contrast guard — for arbitrary consumers
 *   --company-accent-foreground text color on the accent
 *   --primary                   full-strength accent (HSL triplet, shadcn format)
 *   --primary-foreground        text on --primary (white in light, dark ink in dark)
 *   --accent                    soft tint of the accent (HSL triplet)
 *   --accent-foreground         text shade of the accent hue (HSL triplet)
 *   --sidebar-primary(-foreground)
 *   --bar, --bar-subtle         the header band and the small text on it
 *   --tile, --icon-main         the icon circle and the icon outline tone
 *
 * Amber (--cta, --help, --ring, the icons' fill) is the same for every tenant.
 *
 * Band: white text on --bar has at least 7:1 (darkened until it does) and
 * --bar-subtle on --bar at least 4.5:1, in both themes.
 * Icons: --icon-main on --tile at least 3:1, in both themes.
 *
 * Light: the brand color darkened until it has 4.5:1 with white and with
 * every light surface (LIGHT_SURFACES).
 * Dark: a lighter version of the brand hue, raised until it has 7:1 on the
 * dark card and at least 4.5:1 on every dark surface (DARK_SURFACES).
 *
 * shadcn theme variables are HSL triplets WITHOUT the hsl() wrapper
 * (e.g. "32 85% 38%"), so the hex branding color is converted before writing.
 */
import { useEffect } from 'react';
import { useTenant } from '@/lib/useTenant';
import type { CompanyBranding } from '@/lib/types';

export interface Hsl {
  h: number; // 0–360
  s: number; // 0–100
  l: number; // 0–100
}

const WHITE: Hsl = { h: 0, s: 0, l: 100 };

/** Parse '#rrggbb' (or '#rgb') to an HSL triple. Returns null on bad input. */
export function hexToHsl(hex: string): Hsl | null {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let raw = m[1]!;
  if (raw.length === 3) raw = raw.split('').map((c) => c + c).join('');
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** shadcn variable value, e.g. "32 85% 38%". */
export function hslVar({ h, s, l }: Hsl): string {
  return `${h} ${s}% ${l}%`;
}

/** HSL triple to '#rrggbb'. */
export function hslToHex({ h, s, l }: Hsl): string {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** WCAG 2 relative luminance (0–1). */
function luminance(hsl: Hsl): number {
  const hex = hslToHex(hsl);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2 contrast ratio between two colors (1–21). */
export function contrast(a: Hsl, b: Hsl): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** WCAG 2 contrast ratio of the color against white (1–21). */
export function contrastOnWhite(hsl: Hsl): number {
  return contrast(hsl, WHITE);
}

/** Minimum contrast of a tenant brand color against white (WCAG AA text). */
export const MIN_BRAND_CONTRAST = 4.5;

/**
 * Darken the lightness one step at a time until white text on the color (and
 * the color as text on white) reaches MIN_BRAND_CONTRAST. Hue and saturation
 * are kept, so the brand still looks like itself.
 */
export function ensureContrastOnWhite(hsl: Hsl, min = MIN_BRAND_CONTRAST): Hsl {
  let out = { ...hsl };
  while (out.l > 0 && contrastOnWhite(out) < min) out = { ...out, l: out.l - 1 };
  return out;
}

/**
 * The light theme's surfaces (src/index.css `:root`): card, background, muted,
 * secondary and the three soft backgrounds. A test checks these match index.css.
 */
export const LIGHT_SURFACES: Record<string, string> = {
  card: '#ffffff',
  background: '#ffffff',
  muted: '#eef0f7',
  secondary: '#eef0f7',
  'success-soft': '#dff3ea',
  'warning-soft': '#fde8da',
  'danger-soft': '#fbe3e6',
};

/** Dark-mode brand color target on the dark card (links, text, buttons). */
export const DARK_BRAND_TARGET = 7;

/**
 * The dark theme's surfaces (src/index.css `.dark`): card, background, muted,
 * secondary and the three soft backgrounds. Brand text must reach
 * MIN_BRAND_CONTRAST on each. A test checks these match index.css.
 */
export const DARK_SURFACES: Record<string, string> = {
  card: '#1c1f2b',
  background: '#14161f',
  muted: '#242837',
  secondary: '#2a2e3e',
  'success-soft': '#1e3a30',
  'warning-soft': '#3e2a1f',
  'danger-soft': '#3f2228',
};

/** Dark ink (the dark --background) for text on the light dark-mode brand color. */
const DARK_INK: Hsl = hexToHsl(DARK_SURFACES.background!)!;

/** Soft surface tint of the accent (mirrors the theme's light --accent role). */
function accentTint({ h, s }: Hsl): Hsl {
  return { h, s: Math.min(Math.max(s, 30), 60), l: 92 };
}

/** Dark shade of the accent hue for text on the soft tint. */
function accentShade({ h, s }: Hsl): Hsl {
  return { h, s: Math.min(Math.max(s, 35), 60), l: 26 };
}

/**
 * Light-mode brand color: ensureContrastOnWhite, then darkened further (one
 * lightness step at a time) until it also has MIN_BRAND_CONTRAST on every
 * light surface and on its own soft tint.
 */
export function lightBrandColor(hsl: Hsl): Hsl {
  const surfaces = Object.values(LIGHT_SURFACES).map((hex) => hexToHsl(hex)!);
  const ok = (c: Hsl) => [...surfaces, accentTint(c)].every((sf) => contrast(c, sf) >= MIN_BRAND_CONTRAST);
  let out = ensureContrastOnWhite(hsl);
  while (out.l > 0 && !ok(out)) out = { ...out, l: out.l - 1 };
  return out;
}

/**
 * A tenant color as a swatch behind white text (logo tiles, mock buttons):
 * the light-mode guarded brand color, or the ASM indigo when the hex is invalid.
 */
export function brandSwatchHex(hex: string | undefined): string {
  const hsl = hexToHsl(hex ?? '') ?? hexToHsl('#2E2F70')!;
  return hslToHex(lightBrandColor(hsl));
}

/** Dark-mode tint of the accent: a deep surface in the brand hue (like #2A2C4A). */
function darkAccentTint({ h, s }: Hsl): Hsl {
  return { h, s: Math.min(Math.max(s, 20), 30), l: 22 };
}

/** Text shade of the accent hue on the dark tint (like #D6D7FA). */
function darkAccentShade({ h, s }: Hsl): Hsl {
  return { h, s: Math.min(Math.max(s, 40), 80), l: 91 };
}

/**
 * Dark-mode brand color: same hue, a little more saturation, lightness raised
 * one step at a time until it has DARK_BRAND_TARGET on the dark card and at
 * least MIN_BRAND_CONTRAST on every dark surface and on its own dark tint.
 */
export function darkBrandColor(hsl: Hsl): Hsl {
  const card = hexToHsl(DARK_SURFACES.card!)!;
  const surfaces = [...Object.values(DARK_SURFACES).map((hex) => hexToHsl(hex)!), darkAccentTint(hsl)];
  const ok = (c: Hsl) =>
    contrast(c, card) >= DARK_BRAND_TARGET && surfaces.every((sf) => contrast(c, sf) >= MIN_BRAND_CONTRAST);
  let out: Hsl = { h: hsl.h, s: Math.min(Math.max(Math.round(hsl.s * 1.5), 30), 75), l: Math.max(hsl.l, 60) };
  while (out.l < 100 && !ok(out)) out = { ...out, l: out.l + 1 };
  return out;
}

/** White text on the header band: at least this (AAA). */
export const BAND_TARGET = 7;
/** The icon outline on its circle (non-text, WCAG 1.4.11). */
export const ICON_TARGET = 3;

/** Darken (lightness only) until white text on it reaches BAND_TARGET. */
export function bandColor(hsl: Hsl): Hsl {
  let out = { ...hsl };
  while (out.l > 0 && contrastOnWhite(out) < BAND_TARGET) out = { ...out, l: out.l - 1 };
  return out;
}

/** Dark-mode band: a deep shade of the brand hue (like #23244F), white text 7:1 or more. */
function darkBand({ h, s }: Hsl): Hsl {
  return bandColor({ h, s: Math.min(Math.max(s, 30), 45), l: 22 });
}

/** Pale brand tint for the small text on the band (company name, avatar), 4.5:1 or more on it. */
function bandSubtle(bar: Hsl): Hsl {
  let out: Hsl = { h: bar.h, s: Math.min(Math.max(bar.s, 30), 60), l: 90 };
  while (out.l < 100 && contrast(out, bar) < MIN_BRAND_CONTRAST) out = { ...out, l: out.l + 1 };
  return out;
}

/** Move the icon tone away from its circle until it has ICON_TARGET (darker in light, lighter in dark). */
function iconTone(icon: Hsl, tile: Hsl, step: 1 | -1): Hsl {
  let out = { ...icon };
  while (out.l > 0 && out.l < 100 && contrast(out, tile) < ICON_TARGET) out = { ...out, l: out.l + step };
  return out;
}

/**
 * The header band colour for a tenant hex, for pages without a session (the
 * public onboarding form): the light-mode band, or the ASM indigo band.
 */
export function brandBandHex(hex: string | undefined): string {
  const hsl = hexToHsl(hex ?? '') ?? hexToHsl('#2E2F70')!;
  return hslToHex(bandColor(lightBrandColor(hsl)));
}

/** CSS variables for one theme: shadcn HSL triplets, plus the hex accent. */
export type BrandingVars = Record<string, string>;

/**
 * Light and dark variable sets for a brand color, or null when the hex is
 * invalid. Both sets pass the contrast guard (see the file comment).
 */
export function brandingVars(accentColor: string): { light: BrandingVars; dark: BrandingVars } | null {
  const raw = hexToHsl(accentColor);
  if (!raw) return null;
  const light = lightBrandColor(raw);
  const dark = darkBrandColor(raw);
  const lightBar = bandColor(light);
  const darkBar = darkBand(raw);
  const lightTile = accentTint(light);
  const darkTile = darkAccentTint(raw);
  return {
    light: {
      '--company-accent': hslToHex(light),
      '--company-accent-foreground': `hsl(${hslVar(WHITE)})`,
      '--primary': hslVar(light),
      '--primary-foreground': hslVar(WHITE),
      '--accent': hslVar(accentTint(light)),
      '--accent-foreground': hslVar(accentShade(light)),
      '--sidebar-primary': hslVar(light),
      '--sidebar-primary-foreground': hslVar(WHITE),
      '--bar': hslVar(lightBar),
      '--bar-subtle': hslVar(bandSubtle(lightBar)),
      '--tile': hslVar(lightTile),
      '--icon-main': hslVar(iconTone(light, lightTile, -1)),
    },
    dark: {
      '--company-accent': hslToHex(dark),
      '--company-accent-foreground': `hsl(${hslVar(DARK_INK)})`,
      '--primary': hslVar(dark),
      '--primary-foreground': hslVar(DARK_INK),
      '--accent': hslVar(darkAccentTint(raw)),
      '--accent-foreground': hslVar(darkAccentShade(raw)),
      '--sidebar-primary': hslVar(dark),
      '--sidebar-primary-foreground': hslVar(DARK_INK),
      '--bar': hslVar(darkBar),
      '--bar-subtle': hslVar(bandSubtle(darkBar)),
      '--tile': hslVar(darkTile),
      '--icon-main': hslVar(iconTone(darkAccentShade(raw), darkTile, 1)),
    },
  };
}

/** The <style> text: light values on html:root, dark values on html.dark:root. */
export function brandingCss(vars: { light: BrandingVars; dark: BrandingVars }): string {
  const block = (v: BrandingVars) =>
    Object.entries(v)
      .map(([k, val]) => `  ${k}: ${val};`)
      .join('\n');
  // The extra `html` beats the plain :root / .dark rules in index.css.
  return `html:root {\n${block(vars.light)}\n}\nhtml.dark:root {\n${block(vars.dark)}\n}\n`;
}

export const BRANDING_STYLE_ID = 'company-branding';

/** Preset swatches offered by the branding studio (warm, low-saturation). */
export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: 'Amber', hex: '#b45309' },
  { name: 'Terracotta', hex: '#c2410c' },
  { name: 'Olive', hex: '#4d7c0f' },
  { name: 'Teal', hex: '#0f766e' },
  { name: 'Cocoa', hex: '#7c4a2d' },
  { name: 'Plum', hex: '#9d174d' },
  { name: 'Slate', hex: '#475569' },
  { name: 'Steel', hex: '#0369a1' },
];

/**
 * Write a company's branding into the <style id="company-branding"> element
 * (created on first use). No-op (and no crash) when the hex is invalid — the
 * theme defaults stay in place. --ring is left alone: the amber focus outline
 * must stay visible whatever the brand color is.
 */
export function applyCompanyBranding(branding: CompanyBranding | null | undefined): void {
  if (!branding) return;
  const vars = brandingVars(branding.accentColor);
  if (!vars) return;
  let el = document.getElementById(BRANDING_STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = BRANDING_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = brandingCss(vars);
}

/**
 * React hook — applies the ACTIVE company's branding whenever it changes
 * (including tenant switches). Intentionally does NOT restore the theme
 * defaults on unmount: the last active company's identity should persist
 * until another company becomes active.
 */
export function useCompanyBranding(): void {
  const { activeCompany } = useTenant();
  const logoText = activeCompany?.branding.logoText;
  const accentColor = activeCompany?.branding.accentColor;
  useEffect(() => {
    if (logoText === undefined && accentColor === undefined) return;
    applyCompanyBranding({ logoText: logoText ?? '', accentColor: accentColor ?? '' });
  }, [logoText, accentColor]);
}
