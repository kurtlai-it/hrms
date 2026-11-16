/**
 * "Me" panel — opens as a full-width band under the top bar (not a small
 * dropdown). Language, text size and screen colours are big pressed/unpressed
 * buttons; then My payslips, the Super Admin console (SuperAdmin session
 * only), the dev role switcher (dev override only) and Sign out.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banknote, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useRole, type AppRole } from '@/lib/useRole';
import { LANGS, setLanguage, type Lang } from '@/i18n';
import { getTextSize, setTextSize, type TextSize } from '@/lib/textSize';
import { useEffectiveRole } from './useEffectiveRole';
import { visibleNavItems } from './nav';

/** Each language is named in itself, so anyone can find their own. */
const LANG_NAMES: Record<Lang, { label: string; htmlLang: string }> = {
  en: { label: 'English', htmlLang: 'en' },
  ms: { label: 'Bahasa Melayu', htmlLang: 'ms' },
  zh: { label: '中文', htmlLang: 'zh-Hans' },
};
const TEXT_SIZES: TextSize[] = ['normal', 'big', 'bigger'];

const pickClass =
  'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[6px] border-2 border-input bg-card px-5 font-bold text-card-foreground hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground';

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-2 font-bold">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function MePanel({
  id,
  onClose,
  dark,
  onDarkChange,
  onSignOut,
}: {
  id: string;
  onClose: () => void;
  dark: boolean;
  onDarkChange: (dark: boolean) => void;
  onSignOut: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { user, isSuperAdmin } = useAuth();
  const { role: effectiveRole, devOverrideEnabled } = useEffectiveRole();
  const { role: devRole, setRole } = useRole();
  const [size, setSize] = useState<TextSize>(getTextSize);
  const canSeePayslips = visibleNavItems(effectiveRole, isSuperAdmin).some((i) => i.path === '/my-payslips');

  return (
    <section
      id={id}
      aria-label={t('bar.me')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="border-b-2 border-primary bg-card px-4 py-5 text-card-foreground sm:px-6"
    >
      <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
        <Group label={t('me.language')}>
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              lang={LANG_NAMES[l].htmlLang}
              aria-pressed={i18n.language === l}
              onClick={() => setLanguage(l)}
              className={pickClass}
            >
              {LANG_NAMES[l].label}
            </button>
          ))}
        </Group>

        <Group label={t('me.textSize')}>
          {TEXT_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={size === s}
              onClick={() => {
                setTextSize(s);
                setSize(s);
              }}
              className={pickClass}
            >
              {t(`me.${s}`)}
            </button>
          ))}
        </Group>

        <Group label={t('me.screen')}>
          <button type="button" aria-pressed={!dark} onClick={() => onDarkChange(false)} className={pickClass}>
            {t('me.light')}
          </button>
          <button type="button" aria-pressed={dark} onClick={() => onDarkChange(true)} className={pickClass}>
            {t('me.dark')}
          </button>
        </Group>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
        {canSeePayslips && (
          <Link to="/my-payslips" onClick={onClose} className={pickClass}>
            <Banknote className="size-5" aria-hidden="true" />
            {t('me.myPayslips')}
          </Link>
        )}
        {isSuperAdmin && (
          <Link to="/superadmin" onClick={onClose} className={pickClass}>
            <ShieldCheck className="size-5" aria-hidden="true" />
            {t('me.superAdmin')}
          </Link>
        )}
        {devOverrideEnabled && (
          <label className="flex items-center gap-2">
            <span className="font-bold">{t('me.devRole')}</span>
            <select
              value={devRole}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="min-h-[52px] rounded-[6px] border-2 border-input bg-card px-3"
            >
              {(['Admin', 'HR', 'Manager', 'Employee'] as AppRole[]).map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="text-muted-foreground sm:ml-auto">
          {t('me.signedInAs', {
            name: user?.username ?? t('shell.guest'),
            role: t(`role.${user?.role ?? effectiveRole}`),
          })}
        </span>
        <button type="button" onClick={onSignOut} className={pickClass}>
          <LogOut className="size-5" aria-hidden="true" />
          {t('me.signOut')}
        </button>
      </div>
    </section>
  );
}
