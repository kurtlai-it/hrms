/**
 * Home icon grid: big two-tone icons in soft circles with the label
 * underneath, on plain white (IconTile). Most pages are one press away; the
 * "More" tile opens the /more page with every page the session may open,
 * grouped, so the rest are two presses.
 *
 * Items are per role and only pages that role can already open (NAV_ITEMS
 * gating; Public holidays is Admin/HR only). Waiting items get a small red
 * count badge and say it in words ("Leave, 3 waiting for you").
 */
import { useTranslation } from 'react-i18next';
import { Fingerprint } from '@phosphor-icons/react';
import { useAuth } from '@/lib/useAuth';
import { useEffectiveRole } from '@/components/layout/useEffectiveRole';
import { visibleNavItems } from '@/components/layout/nav';
import { IconTile, tileGridClass } from '@/components/layout/IconTile';
import { pageIcon, type PageIcon } from '@/components/layout/pageIcons';
import { usePendingApprovals } from '@/pages/approvals/usePendingApprovals';

interface GridItem {
  key: string;
  /** Locale key app.<label>. */
  label: string;
  path: string;
  /** Defaults to the page's icon (pageIcons). */
  icon?: PageIcon;
  /** Which page decides whether the item shows (defaults to path). */
  gate?: string;
  count?: number;
}

export function AppGrid() {
  const { t } = useTranslation();
  const { role } = useEffectiveRole();
  const { isSuperAdmin } = useAuth();
  const { counts, isApprover } = usePendingApprovals();
  const canOpen = new Set(visibleNavItems(role, isSuperAdmin).map((i) => i.path));
  const waiting = (n: number) => (isApprover && n > 0 ? n : undefined);

  const leave: GridItem = { key: 'leave', label: 'leave', path: '/leave', count: waiting(counts.leave) };
  const attendance: GridItem = { key: 'attendance', label: 'attendance', path: '/attendance' };
  const claims: GridItem = { key: 'claims', label: 'claims', path: '/claims', count: waiting(counts.claims) };
  const myPayslips: GridItem = { key: 'myPayslips', label: 'myPayslips', path: '/my-payslips' };
  const reports: GridItem = { key: 'reports', label: 'reports', path: '/reports' };
  const holidays: GridItem = { key: 'holidays', label: 'holidays', path: '/holidays' };

  const byRole: Record<string, GridItem[]> = {
    Admin: [
      leave, attendance, claims,
      { key: 'allPayslips', label: 'allPayslips', path: '/payroll/batch-payslips', gate: '/payroll' },
      { key: 'staff', label: 'staff', path: '/employees' },
      { key: 'runPayroll', label: 'runPayroll', path: '/payroll' },
      reports, holidays,
      { key: 'company', label: 'company', path: '/company' },
    ],
    Manager: [
      leave, attendance, claims,
      { key: 'approvals', label: 'approvals', path: '/approvals', count: waiting(counts.total) },
      myPayslips,
      { key: 'reviews', label: 'reviews', path: '/kpi' },
      reports, holidays,
    ],
    Employee: [
      { key: 'clock', label: 'clock', path: '/attendance', icon: Fingerprint },
      leave, claims, myPayslips, holidays,
    ],
  };
  const items = (byRole[role === 'HR' ? 'Admin' : role] ?? byRole.Employee!).filter((i) => canOpen.has(i.gate ?? i.path));

  return (
    <ul aria-label={t('app.goTo')} className={tileGridClass}>
      {items.map((item) => (
        <li key={item.key}>
          <IconTile
            to={item.path}
            label={t(`app.${item.label}`)}
            icon={item.icon ?? pageIcon(item.path)}
            count={item.count}
            waiting={item.count ? t('app.waitingSuffix', { count: item.count }) : undefined}
          />
        </li>
      ))}
      <li>
        <IconTile to="/more" label={t('app.more')} icon={pageIcon('/more')} />
      </li>
    </ul>
  );
}
