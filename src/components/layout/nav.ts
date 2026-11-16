/**
 * Nav model — the single source of truth for which pages a session may open
 * (NAV_ITEMS / visibleNavItems) and how they are grouped on the Home screen
 * (HOME_GROUPS / visibleHomeGroups). There is no sidebar: Home shows one big
 * button per group, a group page lists its pages, so every page is at most 2
 * presses from Home (docs/design/DESIGN.md).
 *
 * Role gating: Admin/HR see everything; Manager gets dashboard, attendance,
 * leave, claims, kpi, reports; Employee gets dashboard, attendance, leave,
 * claims. (Payslips live under /payroll which is Admin/HR only.)
 * Module gating: items tagged `module` disappear when the active company has
 * that module disabled (Company Setup → Modules).
 */
import {
  Banknote, BarChart3, Building2, Calendar, CalendarDays, ClipboardList, FileText, Gauge,
  HandCoins, Inbox, LayoutDashboard, Network, Receipt, ScrollText, Settings, ShieldCheck,
  TrendingUp, UserRoundCheck, UserRoundMinus, Users, Wallet, Workflow,
} from 'lucide-react';
import type { AppRole } from '@/lib/roleContext';
import type { ModuleKey } from '@/lib/types';
import { isModuleEnabled } from '@/pages/company/modules';

export interface NavItem {
  path: string;
  /** Locale key for the page name (src/i18n/locales/*.json → nav.*). */
  titleKey: `nav.${string}`;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
  /** Feature-gated by the active company's module toggles when set. */
  module?: ModuleKey;
  /** Visible ONLY to the system SuperAdmin session (auth-aware filter). */
  superAdminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', titleKey: 'nav.dashboard', icon: LayoutDashboard, roles: ['Admin', 'HR', 'Manager', 'Employee'] },
  // Unified approvals inbox — aggregates leave/claims/OT decision queues.
  // Approver roles only in nav; Employees opening /approvals directly see
  // their own pending requests (the route itself is not role-gated).
  { path: '/approvals', titleKey: 'nav.approvals', icon: Inbox, roles: ['Admin', 'HR', 'Manager'] },
  { path: '/employees', titleKey: 'nav.employees', icon: Users, roles: ['Admin', 'HR'] },
  { path: '/contracts', titleKey: 'nav.contracts', icon: ScrollText, roles: ['Admin', 'HR'] },
  { path: '/org', titleKey: 'nav.organization', icon: Network, roles: ['Admin', 'HR'] },
  { path: '/org/chart', titleKey: 'nav.orgChart', icon: Workflow, roles: ['Admin', 'HR'] },
  { path: '/attendance', titleKey: 'nav.attendance', icon: Calendar, roles: ['Admin', 'HR', 'Manager', 'Employee'], module: 'attendance' },
  { path: '/leave', titleKey: 'nav.leave', icon: ClipboardList, roles: ['Admin', 'HR', 'Manager', 'Employee'], module: 'leave' },
  { path: '/holidays', titleKey: 'nav.holidays', icon: CalendarDays, roles: ['Admin', 'HR'] },
  { path: '/claims', titleKey: 'nav.claims', icon: Receipt, roles: ['Admin', 'HR', 'Manager', 'Employee'], module: 'claims' },
  { path: '/payroll', titleKey: 'nav.payroll', icon: Wallet, roles: ['Admin', 'HR'], module: 'payroll' },
  // Employee loans + recurring benefits (pages/loans) — payroll-adjacent, so
  // it shares the payroll module gate; Admin/HR only in nav (employees reach
  // their scoped read-only view from their records page link).
  { path: '/loans', titleKey: 'nav.loansBenefits', icon: HandCoins, roles: ['Admin', 'HR'], module: 'payroll' },
  // Employee self-service payslips (page: pages/payroll/MyPayslipsPage.tsx) —
  // visible to ALL roles; Admin/HR also have the full Payroll section above.
  { path: '/my-payslips', titleKey: 'nav.myPayslips', icon: Banknote, roles: ['Admin', 'HR', 'Manager', 'Employee'], module: 'payroll' },
  { path: '/kpi', titleKey: 'nav.kpi', icon: Gauge, roles: ['Admin', 'HR', 'Manager'], module: 'kpi' },
  { path: '/insights/salary', titleKey: 'nav.salaryInsights', icon: TrendingUp, roles: ['Admin', 'HR'], module: 'insights' },
  { path: '/reports', titleKey: 'nav.reports', icon: FileText, roles: ['Admin', 'HR', 'Manager'], module: 'reports' },
  { path: '/onboarding', titleKey: 'nav.onboarding', icon: UserRoundCheck, roles: ['Admin', 'HR'], module: 'onboarding' },
  { path: '/offboarding', titleKey: 'nav.offboarding', icon: UserRoundMinus, roles: ['Admin', 'HR'], module: 'offboarding' },
  { path: '/company', titleKey: 'nav.companySetup', icon: Building2, roles: ['Admin', 'HR'] },
  { path: '/settings', titleKey: 'nav.settings', icon: Settings, roles: ['Admin'] },
  { path: '/superadmin', titleKey: 'nav.superAdmin', icon: ShieldCheck, roles: ['Admin'], superAdminOnly: true },
];

/**
 * Nav visibility = role filter, then the auth-aware SuperAdmin filter, then
 * the per-company module gate. isModuleEnabled() is non-reactive, so callers
 * must render under a tenant subscription (AppLayout mounts one) to re-run
 * this filter immediately after a tenant switch.
 */
export function visibleNavItems(role: AppRole, isSuperAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((i) => {
    if (i.superAdminOnly) return isSuperAdmin;
    if (!i.roles.includes(role)) return false;
    if (i.module && !isModuleEnabled(i.module)) return false;
    return true;
  });
}

// ── Home screen groups ───────────────────────────────────────────────────────

export type GroupKey = 'staff' | 'time' | 'pay' | 'claims' | 'reports' | 'company';

export interface HomePage {
  /** Route; must be a NAV_ITEMS path so the same role/module gating applies. */
  path: string;
  /** Locale keys page.<pageKey>.name / page.<pageKey>.desc */
  pageKey: string;
}

export interface HomeGroup {
  /** Also the locale keys group.<key> / groupDesc.<key> and the /go/<key> route. */
  key: GroupKey;
  icon: typeof LayoutDashboard;
  pages: HomePage[];
}

/** The 6 big Home buttons and the pages behind each (Approvals live in "Things to do today"). */
export const HOME_GROUPS: HomeGroup[] = [
  {
    key: 'staff',
    icon: Users,
    pages: [
      { path: '/employees', pageKey: 'findStaff' },
      { path: '/onboarding', pageKey: 'addStaff' },
      { path: '/offboarding', pageKey: 'leavingStaff' },
      { path: '/contracts', pageKey: 'contracts' },
    ],
  },
  {
    key: 'time',
    icon: CalendarDays,
    pages: [
      { path: '/leave', pageKey: 'leave' },
      { path: '/attendance', pageKey: 'attendanceToday' },
      { path: '/holidays', pageKey: 'holidays' },
    ],
  },
  {
    key: 'pay',
    icon: Wallet,
    pages: [
      { path: '/payroll', pageKey: 'runPayroll' },
      { path: '/my-payslips', pageKey: 'payslips' },
      { path: '/loans', pageKey: 'loansBenefits' },
    ],
  },
  {
    key: 'claims',
    icon: Receipt,
    pages: [{ path: '/claims', pageKey: 'claims' }],
  },
  {
    key: 'reports',
    icon: BarChart3,
    pages: [
      { path: '/reports', pageKey: 'monthlyReports' },
      { path: '/kpi', pageKey: 'kpi' },
      { path: '/insights/salary', pageKey: 'salaryComparison' },
    ],
  },
  {
    key: 'company',
    icon: Building2,
    pages: [
      { path: '/company', pageKey: 'companyDetails' },
      { path: '/org', pageKey: 'departments' },
      // The org chart is a tab of Departments; its own tile keeps it 2 presses away.
      { path: '/org/chart', pageKey: 'orgChart' },
      { path: '/settings', pageKey: 'settings' },
    ],
  },
];

export interface VisibleHomeGroup {
  group: HomeGroup;
  /** The group's pages this session may open (NAV_ITEMS gating). */
  pages: HomePage[];
  /** Where the big button goes: straight to the page when only one is visible. */
  href: string;
}

/**
 * Big buttons for a session: a group is hidden when none of its pages are
 * visible; a group with exactly one visible page links straight to it.
 */
export function visibleHomeGroups(role: AppRole, isSuperAdmin: boolean): VisibleHomeGroup[] {
  const allowed = new Set(visibleNavItems(role, isSuperAdmin).map((i) => i.path));
  return HOME_GROUPS.flatMap((group) => {
    const pages = group.pages.filter((p) => allowed.has(p.path));
    if (pages.length === 0) return [];
    return [{ group, pages, href: pages.length === 1 ? pages[0]!.path : `/go/${group.key}` }];
  });
}

export function isGroupKey(v: string | undefined): v is GroupKey {
  return HOME_GROUPS.some((g) => g.key === v);
}

export type HelpArea = 'home' | GroupKey | 'other';

export interface RouteContext {
  /** Locale key for the top-bar title; null on Home (the company name is shown). */
  titleKey: string | null;
  /** Which help.tips.<area> list the Help button shows. */
  helpArea: HelpArea;
}

const under = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);

/**
 * Top-bar title and help tips for a route: group pages use the group name,
 * pages listed on a group page use their friendly name (e.g. "Find a staff
 * member"), anything else falls back to its NAV_ITEMS title (longest match).
 */
export function routeContext(pathname: string): RouteContext {
  if (pathname === '/') return { titleKey: null, helpArea: 'home' };
  if (pathname === '/more') return { titleKey: 'app.allPages', helpArea: 'home' };
  const go = /^\/go\/([^/]+)/.exec(pathname)?.[1];
  if (isGroupKey(go)) return { titleKey: `group.${go}`, helpArea: go };

  let best: { len: number; ctx: RouteContext } | null = null;
  for (const g of HOME_GROUPS) {
    for (const p of g.pages) {
      if (under(pathname, p.path) && (!best || p.path.length > best.len)) {
        best = { len: p.path.length, ctx: { titleKey: `page.${p.pageKey}.name`, helpArea: g.key } };
      }
    }
  }
  if (best) return best.ctx;

  const nav = NAV_ITEMS.filter((i) => i.path !== '/' && under(pathname, i.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
  return { titleKey: nav?.titleKey ?? null, helpArea: 'other' };
}
