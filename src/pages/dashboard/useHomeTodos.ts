/**
 * "Things to do today" items for Home and the phone To do button (same list,
 * so the count always matches). Facts come from live collections; ordering
 * lives in ./homeTodos (pure, unit-tested):
 *  - Admin / HR: this month's payroll not run or still a draft (with the
 *    payday when the company has one), staff pay and EPF/SOCSO/EIS/PCB not
 *    marked paid for last or this month's finished run, new-staff forms,
 *    probation ended or ending within 14 days, contracts ending soon, and the
 *    approval queues. A row with a date only appears when the date is known.
 *  - Manager: the approval queues for their team.
 *  - Employee: clock in (working day, not yet clocked in) and their own
 *    requests waiting for a decision.
 * Approval counts come from usePendingApprovals (same numbers as /approvals).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/useAuth';
import { useTenant } from '@/lib/useTenant';
import { useCollection } from '@/lib/db';
import { isRestDay } from '@/lib/appSettings';
import { isHoliday } from '@/lib/holidays';
import { useOnboardLinks } from '@/lib/onboardLinks';
import { fmtRM, monthKey } from '@/lib/utils';
import type { AttendanceRecord, Claim, Employee, LeaveRequest, PayrollRun, Settings } from '@/lib/types';
import { paydayFor, shiftMonth, statutoryDueFor } from '@/lib/payDates';
import { CONTRACTS_COLLECTION, contractStatus, type EmploymentContract } from '@/lib/contracts';
import { probationDaysLeft, probationEndDate } from '@/pages/employees/helpers';
import { formatDate } from '@/i18n';
import { usePendingApprovals } from '@/pages/approvals/usePendingApprovals';
import { useEffectiveRole } from '@/components/layout/useEffectiveRole';
import { visibleNavItems } from '@/components/layout/nav';
import { isPayrollDue, orderTodos, type TodoFact } from './homeTodos';
import { todayISO } from './lib';

export interface HomeTodo {
  id: string;
  text: string;
  /** Button words that say what it does ('Review leave', 'Start payroll', 'Clock in'). */
  action: string;
  href: string;
}

export function useHomeTodos(): HomeTodo[] {
  const { t } = useTranslation();
  const { role } = useEffectiveRole();
  const { isSuperAdmin, employeeId } = useAuth();
  const { activeCompany } = useTenant();
  const { counts, isApprover, queues } = usePendingApprovals();
  const { items: runs } = useCollection<PayrollRun>('payrollRuns');
  const { items: leaves } = useCollection<LeaveRequest>('leaves');
  const { items: claims } = useCollection<Claim>('claims');
  const { items: attendance } = useCollection<AttendanceRecord>('attendance');
  const { items: employees } = useCollection<Employee>('employees');
  const { items: settingsItems } = useCollection<Settings>('settings');
  const { items: onboardLinks } = useOnboardLinks();
  const { items: contracts } = useCollection<EmploymentContract>(CONTRACTS_COLLECTION);
  // Read once per mount so render stays pure (react-hooks/purity).
  const [now] = useState(() => new Date());

  const canOpen = new Set(visibleNavItems(role, isSuperAdmin).map((i) => i.path));
  const isAdminHR = role === 'Admin' || role === 'HR';
  const today = todayISO();
  const facts: TodoFact[] = [];

  const paydayDay = settingsItems[0]?.paydayDay || undefined;
  if (isAdminHR && canOpen.has('/payroll')) {
    const mk = monthKey(now);
    const run = runs.find((r) => r.monthKey === mk);
    if (!run || run.status === 'draft') {
      facts.push({
        kind: 'payroll',
        count: 1,
        href: run ? `/payroll/runs/${run.id}` : '/payroll',
        draft: Boolean(run),
        due: isPayrollDue(now.getDate(), activeCompany?.config.payrollCutoffDay ?? 25),
        month: mk,
        date: paydayDay ? paydayFor(mk, paydayDay) : undefined,
      });
    }
    // Last and this month's finished runs: staff pay and statutory payments
    // not yet marked as done on the payroll tracker.
    for (const m of [shiftMonth(mk, -1), mk]) {
      const done = runs.find((r) => r.monthKey === m && r.status === 'finalized');
      if (!done) continue;
      if (paydayDay && !done.stepsDone?.staffPaid) {
        facts.push({ kind: 'staffPay', count: 1, href: `/payroll/runs/${done.id}`, month: m, date: paydayFor(m, paydayDay) });
      }
      if (!done.stepsDone?.statutoryPaid) {
        facts.push({ kind: 'statutory', count: 1, href: `/payroll/runs/${done.id}`, month: m, date: statutoryDueFor(m) });
      }
    }
  }
  if (isAdminHR && canOpen.has('/employees')) {
    // Probation ended, or ending within 14 days, and not yet confirmed.
    const due = employees
      .filter((e) => e.status === 'probation' && probationDaysLeft(e, now) <= 14)
      .map((e) => probationEndDate(e))
      .sort();
    if (due.length) facts.push({ kind: 'probation', count: due.length, href: '/employees', date: due[0], upcoming: due[0]! >= today });
  }
  if (isAdminHR && canOpen.has('/contracts')) {
    const ending = contracts
      .filter((c) => contractStatus(c, today) === 'expiring' && c.endDate)
      .map((c) => c.endDate!)
      .sort();
    if (ending.length) facts.push({ kind: 'contracts', count: ending.length, href: '/contracts', date: ending[0] });
  }
  if (isAdminHR && canOpen.has('/onboarding')) {
    facts.push({
      kind: 'onboarding',
      count: onboardLinks.filter((l) => l.status === 'submitted').length,
      href: '/onboarding',
    });
  }
  if (isApprover) {
    facts.push({ kind: 'leave', count: counts.leave, href: '/approvals?tab=leave' });
    facts.push({ kind: 'claims', count: counts.claims, href: '/approvals?tab=claims' });
    facts.push({ kind: 'ot', count: counts.ot, href: '/approvals?tab=ot' });
  }
  if (role === 'Employee' && employeeId) {
    if (canOpen.has('/attendance')) {
      const state = employees.find((e) => e.id === employeeId)?.state ?? settingsItems[0]?.hqState ?? 'KUL';
      const record = attendance.find((a) => a.employeeId === employeeId && a.date === today);
      const workingDay = !isRestDay(today, state) && !isHoliday(today, state);
      const notIn = !record || (!record.clockIn && record.status !== 'leave' && record.status !== 'holiday' && record.status !== 'rest-day');
      facts.push({ kind: 'clockIn', count: workingDay && notIn ? 1 : 0, href: '/attendance' });
    }
    facts.push({
      kind: 'ownLeave',
      count: leaves.filter((l) => l.employeeId === employeeId && l.status === 'pending').length,
      href: '/leave',
    });
    facts.push({
      kind: 'ownClaims',
      count: claims.filter((c) => c.employeeId === employeeId && c.status === 'submitted').length,
      href: '/claims',
    });
  }

  const month = formatDate(now, { month: 'long' });
  const monthOf = (mk?: string) => (mk ? formatDate(`${mk}-01`, { month: 'long' }) : month);
  const day = (iso?: string) => (iso ? formatDate(iso, { day: 'numeric', month: 'short' }) : '');
  const claimsTotal = fmtRM(queues.claims.reduce((sum, c) => sum + c.amount, 0));
  return orderTodos(facts).map((f): HomeTodo => {
    switch (f.kind) {
      case 'clockIn':
        return { id: f.kind, text: t('home.todoClockIn'), action: t('home.clockIn'), href: f.href };
      case 'payroll':
        return f.draft
          ? { id: f.kind, text: f.date ? t('home.todoPayrollFinishDue', { month, date: day(f.date) }) : t('home.todoPayrollFinish', { month }), action: t('home.finishPayroll'), href: f.href }
          : { id: f.kind, text: f.date ? t('home.todoPayrollStartDue', { month, date: day(f.date) }) : t('home.todoPayrollStart', { month }), action: t('home.startPayroll'), href: f.href };
      case 'staffPay':
        return { id: `${f.kind}-${f.month}`, text: t('home.todoStaffPay', { month: monthOf(f.month), date: day(f.date) }), action: t('home.openPayroll'), href: f.href };
      case 'statutory':
        return { id: `${f.kind}-${f.month}`, text: t('home.todoStatutory', { month: monthOf(f.month), date: day(f.date) }), action: t('home.openPayroll'), href: f.href };
      case 'probation':
        return {
          id: f.kind,
          text: t(f.upcoming ? 'home.todoProbationEnds' : 'home.todoProbationEnded', { count: f.count, date: day(f.date) }),
          action: t('home.confirmOrExtend'),
          href: f.href,
        };
      case 'contracts':
        return { id: f.kind, text: t('home.todoContracts', { count: f.count, date: day(f.date) }), action: t('home.reviewContracts'), href: f.href };
      case 'leave':
        return { id: f.kind, text: t('home.todoLeave', { count: f.count }), action: t('home.reviewLeave'), href: f.href };
      case 'claims':
        return { id: f.kind, text: t('home.todoClaims', { count: f.count, amount: claimsTotal }), action: t('home.reviewClaims'), href: f.href };
      case 'ot':
        return { id: f.kind, text: t('home.todoOt', { count: f.count }), action: t('home.reviewOt'), href: f.href };
      case 'onboarding':
        return { id: f.kind, text: t('home.todoOnboarding', { count: f.count }), action: t('home.checkForms'), href: f.href };
      case 'ownLeave':
        return { id: f.kind, text: t('home.todoOwnLeave', { count: f.count }), action: t('home.seeMyLeave'), href: f.href };
      case 'ownClaims':
        return { id: f.kind, text: t('home.todoOwnClaims', { count: f.count }), action: t('home.seeMyClaims'), href: f.href };
    }
  });
}
