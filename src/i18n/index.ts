/**
 * UI language (Me panel: English / Bahasa Melayu / 中文).
 *
 * Locale files are bundled and loaded synchronously, so the first render is
 * already translated. The choice is remembered in localStorage
 * (myhrms:lang) and mirrored to <html lang> for screen readers and fonts.
 * Import this module once for its side effect (main.tsx, ui test setup).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ms from './locales/ms.json';
import zh from './locales/zh.json';

export type Lang = 'en' | 'ms' | 'zh';

export const LANGS: Lang[] = ['en', 'ms', 'zh'];

export const LANG_KEY = 'myhrms:lang';

/** <html lang> value per UI language. */
export const HTML_LANG: Record<Lang, string> = { en: 'en', ms: 'ms', zh: 'zh-Hans' };

/** Intl locale per UI language (dates, months, weekdays, relative time). */
export const DATE_LOCALE: Record<Lang, string> = { en: 'en-MY', ms: 'ms-MY', zh: 'zh-MY' };

function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'ms' || v === 'zh';
}

/** Saved choice, or 'en' when nothing (or something invalid) is stored. */
export function getSavedLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return isLang(v) ? v : 'en';
  } catch {
    return 'en';
  }
}

/** The language currently on screen. */
export function currentLang(): Lang {
  return isLang(i18n.language) ? i18n.language : 'en';
}

function syncHtmlLang(lang: string): void {
  if (typeof document === 'undefined' || !isLang(lang)) return;
  document.documentElement.lang = HTML_LANG[lang];
}

/** Switch the UI language, remember it and update <html lang>. */
export function setLanguage(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore — still switch for this session */
  }
  void i18n.changeLanguage(lang);
}

/** Locale-aware date, e.g. '5 Mac 2026' (BM) for '2026-03-05'. */
export function formatDate(
  iso: string | Date,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  const d = typeof iso === 'string' ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso) : iso;
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(DATE_LOCALE[currentLang()], opts).format(d);
}

i18n.on('languageChanged', syncHtmlLang);

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ms: { translation: ms }, zh: { translation: zh } },
  lng: getSavedLang(),
  fallbackLng: 'en',
  supportedLngs: LANGS,
  interpolation: { escapeValue: false }, // React already escapes
  initAsync: false,
});
syncHtmlLang(currentLang());

export default i18n;
