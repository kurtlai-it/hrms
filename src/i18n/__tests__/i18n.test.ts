/**
 * Language setting: agreed labels, persistence under myhrms:lang, <html lang>,
 * plurals and Intl date formatting per language.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { installLocalStorage } from '@/lib/__tests__/storageStub';

type I18nModule = typeof import('../index');
let mod: I18nModule;
const html = { lang: '' };
const realDocument = globalThis.document;

beforeAll(async () => {
  installLocalStorage();
  Object.defineProperty(globalThis, 'document', {
    value: { documentElement: html },
    configurable: true,
    writable: true,
  });
  mod = await import('../index');
});
afterAll(() => {
  Object.defineProperty(globalThis, 'document', { value: realDocument, configurable: true, writable: true });
});
beforeEach(() => mod.setLanguage('en'));

// Agreed labels from hrms-claude-code-prompts-v4.md, Prompt 2 (key: EN / BM / ZH);
// the Home heading was reworded in the wording pass ("Waiting for you · <date>").
const AGREED: [string, string, string, string][] = [
  ['home.waitingFor', 'Waiting for you · {{date}}', 'Menunggu anda · {{date}}', '等您处理 · {{date}}'],
  ['home.what', 'What do you want to do?', 'Apa yang anda mahu buat?', '您想做什么？'],
  ['group.staff', 'Staff', 'Staf', '员工'],
  ['group.time', 'Leave and attendance', 'Cuti dan kehadiran', '请假与考勤'],
  ['group.pay', 'Pay', 'Gaji', '薪资'],
  ['group.claims', 'Claims', 'Tuntutan', '报销'],
  ['group.reports', 'Reports', 'Laporan', '报告'],
  ['group.company', 'Company', 'Syarikat', '公司'],
  ['bar.back', 'Back', 'Kembali', '返回'],
  ['bar.home', 'Home', 'Utama', '主页'],
  ['bar.help', 'Help', 'Bantuan', '帮助'],
  ['bar.me', 'Me', 'Saya', '我的'],
  ['me.textSize', 'Text size', 'Saiz teks', '字体大小'],
  ['me.normal', 'Normal', 'Biasa', '标准'],
  ['me.big', 'Big', 'Besar', '大'],
  ['me.bigger', 'Bigger', 'Lebih besar', '特大'],
];

describe('i18n', () => {
  it('uses the agreed labels in all three languages', () => {
    for (const [key, en, ms, zh] of AGREED) {
      expect(mod.default.t(key, { lng: 'en' })).toBe(en);
      expect(mod.default.t(key, { lng: 'ms' })).toBe(ms);
      expect(mod.default.t(key, { lng: 'zh' })).toBe(zh);
    }
  });

  it('switches language, remembers it and sets <html lang>', () => {
    mod.setLanguage('ms');
    expect(mod.default.t('bar.home')).toBe('Utama');
    expect(localStorage.getItem(mod.LANG_KEY)).toBe('ms');
    expect(html.lang).toBe('ms');

    mod.setLanguage('zh');
    expect(mod.default.t('bar.home')).toBe('主页');
    expect(html.lang).toBe('zh-Hans');

    mod.setLanguage('en');
    expect(html.lang).toBe('en');
  });

  it('reads the saved language, ignoring junk', () => {
    localStorage.setItem(mod.LANG_KEY, 'zh');
    expect(mod.getSavedLang()).toBe('zh');
    localStorage.setItem(mod.LANG_KEY, 'fr');
    expect(mod.getSavedLang()).toBe('en');
  });

  it('handles plurals', () => {
    expect(mod.default.t('common.days', { count: 1 })).toBe('1 day');
    expect(mod.default.t('common.days', { count: 3 })).toBe('3 days');
    mod.setLanguage('ms');
    expect(mod.default.t('common.days', { count: 3 })).toBe('3 hari');
  });

  it('formats dates with en-MY / ms-MY / zh-MY', () => {
    expect(mod.formatDate('2026-03-05')).toBe(
      new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(2026, 2, 5)),
    );
    expect(mod.formatDate('2026-03-05')).toContain('Mar');
    mod.setLanguage('ms');
    expect(mod.formatDate('2026-03-05')).toContain('Mac');
    mod.setLanguage('zh');
    expect(mod.formatDate('2026-03-05')).toContain('3月');
  });

  it('keeps PCB and EA untranslated', () => {
    for (const lng of mod.LANGS) {
      expect(mod.default.t('dash.compliance.cp39.title', { lng })).toContain('PCB');
      expect(mod.default.t('dash.compliance.ea.title', { lng })).toContain('EA');
    }
  });
});
