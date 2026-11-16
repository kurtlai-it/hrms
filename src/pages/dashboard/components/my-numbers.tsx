/**
 * Home "My numbers" (Employee and Manager only): plain lines about the
 * person themselves — annual leave left, days present this month (with
 * today's clock-in time once there is one), claims waiting for approval, and
 * the next payday when the company has set one. Each line is a big link to its page; a line is hidden
 * when its page is switched off for the company. Shown as one plain line
 * under the "Things to do" strip.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/useAuth';
import { useCollection } from '@/lib/db';
import { fmtRM, monthKey } from '@/lib/utils';
import type { AttendanceRecord, Claim, LeaveBalance, Settings } from '@/lib/types';
import { formatDate } from '@/i18n';
import { nextPayday } from '@/lib/payDates';
import { todayISO } from '../lib';
import { useEffectiveRole } from '@/components/layout/useEffectiveRole';
import { visibleNavItems } from '@/components/layout/nav';

interface Line {
  id: string;
  label: string;
  value: string;
  href: string;
}

export function MyNumbers() {
  const { t } = useTranslation();
  const { role } = useEffectiveRole();
  const { employeeId, isSuperAdmin } = useAuth();
  const { items: balances } = useCollection<LeaveBalance>('leaveBalances');
  const { items: attendance } = useCollection<AttendanceRecord>('attendance');
  const { items: claims } = useCollection<Claim>('claims');
  const { items: settingsItems } = useCollection<Settings>('settings');

  if ((role !== 'Employee' && role !== 'Manager') || !employeeId) return null;

  const canOpen = new Set(visibleNavItems(role, isSuperAdmin).map((i) => i.path));
  const lines: Line[] = [];

  if (canOpen.has('/leave')) {
    const b = balances.find((x) => x.employeeId === employeeId && x.year === new Date().getFullYear());
    lines.push({
      id: 'leave',
      label: t('home.leaveLeft'),
      value: b ? t('common.days', { count: b.annualEntitled + b.carriedForward - b.annualUsed }) : t('home.noRecord'),
      href: '/leave',
    });
  }
  if (canOpen.has('/attendance')) {
    const mine = attendance.filter((a) => a.employeeId === employeeId && a.date.startsWith(monthKey()));
    const days = mine.filter((a) => a.status === 'present').length + mine.filter((a) => a.status === 'half-day').length * 0.5;
    lines.push({ id: 'present', label: t('home.presentMonth'), value: t('common.days', { count: days }), href: '/attendance' });
    const clockIn = mine.find((a) => a.date === todayISO())?.clockIn;
    if (clockIn) lines.unshift({ id: 'clockIn', label: t('home.clockedIn'), value: clockIn, href: '/attendance' });
  }
  if (canOpen.has('/claims')) {
    const waiting = claims.filter((c) => c.employeeId === employeeId && c.status === 'submitted');
    lines.push({
      id: 'claims',
      label: t('home.claimsWaiting'),
      value: t('home.claimsValue', { count: waiting.length, amount: fmtRM(waiting.reduce((s, c) => s + c.amount, 0)) }),
      href: '/claims',
    });
  }
  const paydayDay = settingsItems[0]?.paydayDay;
  if (paydayDay && canOpen.has('/my-payslips')) {
    lines.push({
      id: 'payday',
      label: t('home.nextPayday'),
      value: formatDate(nextPayday(todayISO(), paydayDay), { weekday: 'short', day: 'numeric', month: 'short' }),
      href: '/my-payslips',
    });
  }
  if (lines.length === 0) return null;

  // One plain line of the three figures, each a link.
  return (
    <section aria-labelledby="home-my-numbers">
      <h2 id="home-my-numbers" className="sr-only">
        {t('home.myNumbers')}
      </h2>
      <ul className="flex flex-wrap gap-x-8 gap-y-1">
        {lines.map((l) => (
          <li key={l.id}>
            <Link to={l.href} className="inline-flex min-h-12 flex-wrap items-center gap-x-2 hover:underline">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="font-bold">{l.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
