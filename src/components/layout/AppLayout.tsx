/**
 * App shell for older, non-technical HR staff (docs/design/DESIGN.md):
 *  - Indigo header band on every page (--bar), with only 4 controls: Back,
 *    Home, Help, Me (Back/Home hidden on Home, where the band greets the
 *    person and names the company). Phone: Home and Me move to a
 *    3-button bottom bar (Home, To do, Me).
 *  - No sidebar, no dropdown navigation: Home's icon grid and its "More"
 *    list reach every page in at most 2 presses.
 *  - Me opens a full-width panel (language, text size, screen, sign out);
 *    Help opens a sheet of tips for the current page.
 *
 * The nav model (NAV_ITEMS / visibleNavItems / HOME_GROUPS) lives in ./nav
 * and the role resolver in ./useEffectiveRole.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, CircleHelp, House, ShieldCheck } from 'lucide-react';
import { House as HouseDuo, ListChecks, UserCircle } from '@phosphor-icons/react';
import { cn, initialsOf } from '@/lib/utils';
import { useCollection } from '@/lib/db';
import type { Employee } from '@/lib/types';
import { greetingName } from '@/pages/dashboard/lib';
import { useAuth } from '@/lib/useAuth';
import { useTenant } from '@/lib/useTenant';
import { useCompanyBranding } from '@/pages/company/branding';
import { useHomeTodos } from '@/pages/dashboard/useHomeTodos';
import TrialExpiredBanner from '@/pages/superadmin/TrialExpiredBanner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { routeContext } from './nav';
import { useCompanyLabel } from './useCompanyLabel';
import MePanel from './MePanel';
import HelpSheet from './HelpSheet';

const THEME_KEY = 'myhrms:theme';
const ME_PANEL_ID = 'me-panel';

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    // Paper is always black on white: print with the light tokens.
    const toLight = () => root.classList.remove('dark');
    const back = () => root.classList.toggle('dark', dark);
    window.addEventListener('beforeprint', toLight);
    window.addEventListener('afterprint', back);
    return () => {
      window.removeEventListener('beforeprint', toLight);
      window.removeEventListener('afterprint', back);
    };
  }, [dark]);
  return { dark, setDark };
}

/** Header buttons: 48px tall at every text size, like the avatar circle. */
const barButton =
  'inline-flex h-[48px] min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-md px-4 font-bold [&_svg]:size-6';
const ghostOnBrand = 'border-2 border-bar-foreground bg-transparent text-bar-foreground hover:bg-bar-foreground/10';

function TopBar({
  title,
  isHome,
  meOpen,
  onToggleMe,
  onHelp,
  person,
}: {
  title: string;
  isHome: boolean;
  meOpen: boolean;
  onToggleMe: () => void;
  onHelp: () => void;
  /** Greeting and avatar. */
  person: { firstName: string; initials: string; company: string };
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // React Router gives the first entry of a session the key 'default': with
  // nothing to go back to, Back goes Home instead of leaving the app.
  const goBack = () => (location.key === 'default' ? navigate('/') : navigate(-1));

  // Indigo header band. Home shows "Hello, <first name>" and the company; a
  // round initials avatar opens Me (the word "Me" is next to it from sm up;
  // phones also have the labelled Me in the bottom bar).
  return (
    <header className="flex flex-wrap items-center gap-2 bg-bar px-3 py-3 text-bar-foreground sm:flex-nowrap sm:gap-4 sm:px-6 print:hidden">
      <img
        src={`${import.meta.env.BASE_URL}brand/asm-logo.png`}
        alt={t('bar.logo')}
        className="size-11 shrink-0 rounded-lg sm:size-12"
      />
      {isHome ? (
        <div className="min-w-0 flex-1">
          <p className="text-[1.15rem] font-bold leading-tight [overflow-wrap:anywhere]">{person.firstName ? t('app.hello', { name: person.firstName }) : t('app.helloAlone')}</p>
          <p className="text-bar-subtle [overflow-wrap:anywhere]">{person.company}</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button type="button" onClick={goBack} className={cn(barButton, ghostOnBrand)}>
              <ChevronLeft aria-hidden="true" />
              {t('bar.back')}
            </button>
            <Link to="/" className={cn(barButton, ghostOnBrand, 'hidden sm:inline-flex')}>
              <House aria-hidden="true" />
              {t('bar.home')}
            </Link>
          </div>
          <div className="order-last min-w-0 basis-full text-[1.05rem] font-bold [overflow-wrap:anywhere] sm:order-none sm:basis-0 sm:flex-1 sm:text-[1.2rem]">{title}</div>
        </>
      )}
      <button
        type="button"
        onClick={onHelp}
        className={cn(barButton, 'ml-auto border-2 border-help-border bg-help text-help-foreground hover:bg-help/90 sm:ml-0')}
      >
        <CircleHelp aria-hidden="true" />
        {t('bar.help')}
      </button>
      <button
        type="button"
        onClick={onToggleMe}
        aria-expanded={meOpen}
        aria-controls={ME_PANEL_ID}
        className="inline-flex h-[48px] shrink-0 items-center gap-2 rounded-full pr-1 font-bold sm:pr-3"
      >
        <span aria-hidden="true" className="flex size-[48px] shrink-0 items-center justify-center rounded-full bg-bar-subtle font-bold text-bar">
          {person.initials}
        </span>
        {/* The button's name is "Me" (read on phones, shown from sm up). */}
        <span className="sr-only sm:not-sr-only">{t('bar.me')}</span>
      </button>
    </header>
  );
}

/** Phone only: Home, To do (count), Me — 84px tall, two-tone icons, always labelled. */
function BottomBar({ meOpen, onToggleMe }: { meOpen: boolean; onToggleMe: () => void }) {
  const { t } = useTranslation();
  const todoCount = useHomeTodos().length;
  const tab =
    'flex flex-col items-center justify-center gap-0.5 font-bold [&_svg]:size-7';
  return (
    <nav
      aria-label={t('a11y.mainNav')}
      className="fixed inset-x-0 bottom-0 z-30 grid h-[84px] grid-cols-3 border-t-2 border-border bg-card text-card-foreground sm:hidden print:hidden"
    >
      <NavLink
        to="/"
        end
        className={({ isActive }) => cn(tab, isActive && !meOpen && 'bg-accent text-accent-foreground')}
      >
        <HouseDuo weight="duotone" className="duo-icon" aria-hidden="true" />
        {t('bar.home')}
      </NavLink>
      <Link to={{ pathname: '/', hash: '#todo' }} className={tab}>
        <ListChecks weight="duotone" className="duo-icon" aria-hidden="true" />
        {t('bar.todo', { count: todoCount })}
      </Link>
      <button
        type="button"
        onClick={onToggleMe}
        aria-expanded={meOpen}
        aria-controls={ME_PANEL_ID}
        className={cn(tab, meOpen && 'bg-accent text-accent-foreground')}
      >
        <UserCircle weight="duotone" className="duo-icon" aria-hidden="true" />
        {t('bar.me')}
      </button>
    </nav>
  );
}

/**
 * SuperAdmin system-view banner: shown when the session has no active company
 * (isSystemView). Operational pages fall back to the co-asm namespace in this
 * state (docs/tenant-api.md) — the banner makes that explicit and offers a
 * company picker to enter a tenant, plus a shortcut to the Super Admin
 * console.
 */
function SystemViewBanner() {
  const { t } = useTranslation();
  const { isSuperAdmin } = useAuth();
  const { isSystemView, companies, setActiveCompany } = useTenant();
  if (!isSuperAdmin || !isSystemView) return null;
  return (
    <div className="border-b border-warning/40 bg-warning-soft">
      <div className="mx-auto flex w-full max-w-[68rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
        <span className="flex items-center gap-2 font-medium text-warning">
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
          {t('shell.systemViewBanner')}
        </span>
        <Select onValueChange={(id) => setActiveCompany(id)}>
          <SelectTrigger className="min-h-12 w-64 bg-card">
            <SelectValue placeholder={t('shell.enterCompany')} />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <NavLink
          to="/superadmin"
          className="ml-auto inline-flex min-h-12 items-center font-medium text-warning underline-offset-4 hover:underline"
        >
          {t('shell.openSuperAdmin')}
        </NavLink>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children?: ReactNode }) {
  // Applies the ACTIVE company's branding (accent color → shadcn CSS vars)
  // app-wide; re-runs automatically on every tenant switch. Mounted here
  // once so every page and the shell itself are themed.
  useCompanyBranding();
  // Tenant subscription: re-renders the shell (titles, Home buttons, banner)
  // whenever the active company changes.
  useTenant();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const companyLabel = useCompanyLabel();
  const { dark, setDark } = useDarkMode();
  const { logout, user, employeeId } = useAuth();
  const { items: employees } = useCollection<Employee>('employees');
  const staffName = employees.find((e) => e.id === employeeId)?.name?.trim() ?? '';
  const fullName = greetingName(staffName, user?.username);
  const person = {
    // Only a real staff name is used in the greeting; accounts not linked to
    // a staff member (admin, hr) get "Hello" alone.
    firstName: staffName.split(' ')[0] ?? '',
    initials: initialsOf(fullName || '?'),
    company: companyLabel,
  };

  // The Me panel belongs to the page it was opened on: navigating closes it
  // (no effect needed — it is open only while the path is unchanged).
  const [meOpenOn, setMeOpenOn] = useState<string | null>(null);
  const meOpen = meOpenOn === pathname;
  const toggleMe = () => setMeOpenOn(meOpen ? null : pathname);
  const [helpOpen, setHelpOpen] = useState(false);

  const { titleKey, helpArea } = routeContext(pathname);
  const title = titleKey ? t(titleKey) : companyLabel;

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-foreground font-bold text-background focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:inline-flex focus:min-h-12 focus:items-center focus:px-5"
      >
        {t('a11y.skip')}
      </a>
      <div className="sticky top-0 z-30">
        <TopBar
          title={title}
          isHome={pathname === '/'}
          meOpen={meOpen}
          onToggleMe={toggleMe}
          onHelp={() => setHelpOpen(true)}
          person={person}
        />
        {meOpen && (
          <MePanel
            id={ME_PANEL_ID}
            onClose={() => setMeOpenOn(null)}
            dark={dark}
            onDarkChange={setDark}
            onSignOut={signOut}
          />
        )}
      </div>
      <SystemViewBanner />
      <TrialExpiredBanner />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[76rem] px-4 pb-[7rem] pt-6 sm:px-6 sm:pb-12 sm:pt-8 print:max-w-none print:p-0">
        {children ?? <Outlet />}
      </main>
      <BottomBar meOpen={meOpen} onToggleMe={toggleMe} />
      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} area={helpArea} pageTitle={title} />
    </div>
  );
}
