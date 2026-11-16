/**
 * Headline figures as one summary line, role-scoped via useAuth():
 *  - Admin / HR → company-wide: active headcount, present today,
 *    pending approvals (leave + claims + OT) and this month's payroll cost
 *    (finalized run when available, statutory estimate otherwise).
 *  - Manager    → same cards scoped to their own department; the payroll-cost
 *    card is withheld (company spend is Admin/HR-only).
 *  - Employee   → self only: own attendance this month, own annual-leave
 *    balance, own pending claims.
 */
import { SummaryLine } from '@/components/ui/summary-line';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/useAuth';
import { useCollection } from '@/lib/db';
import { fmtRM, monthKey } from '@/lib/utils';
import type {
  AttendanceRecord, Claim, Employee, LeaveBalance, LeaveRequest, PayrollRun,
} from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { estimateMonthlyEmployerCost, todayISO } from '@/pages/dashboard/lib';

interface StatCard {
  title: string;
  value: string;
  hint: string;
}

export function StatCards() {
  const { t } = useTranslation();
  const { role, employeeId, scopeEmployees, scopeByEmployee } = useAuth();
  const { items: employees } = useCollection<Employee>('employees');
  const { items: attendance } = useCollection<AttendanceRecord>('attendance');
  const { items: leaves } = useCollection<LeaveRequest>('leaves');
  const { items: claims } = useCollection<Claim>('claims');
  const { items: runs } = useCollection<PayrollRun>('payrollRuns');
  const { items: leaveBalances } = useCollection<LeaveBalance>('leaveBalances');

  if (employees.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[7.5rem] rounded-xl" />
        ))}
      </div>
    );
  }

  const today = todayISO();
  const thisMonth = monthKey();

  // ── Employee: self-scoped personal cards ──────────────────────────────────
  if (role === 'Employee') {
    const myAttendance = employeeId
      ? attendance.filter((a) => a.employeeId === employeeId && a.date.startsWith(thisMonth))
      : [];
    const presentDays = myAttendance.filter((a) => a.status === 'present').length;
    const halfDays = myAttendance.filter((a) => a.status === 'half-day').length;
    const leaveDays = myAttendance.filter((a) => a.status === 'leave').length;

    const year = new Date().getFullYear();
    const balance = employeeId
      ? leaveBalances.find((b) => b.employeeId === employeeId && b.year === year)
      : undefined;
    const annualTotal = balance ? balance.annualEntitled + balance.carriedForward : 0;
    const annualLeft = balance ? annualTotal - balance.annualUsed : null;

    const myClaims = employeeId ? claims.filter((c) => c.employeeId === employeeId) : [];
    const myPendingClaims = myClaims.filter((c) => c.status === 'submitted');
    const pendingClaimsAmount = myPendingClaims.reduce((s, c) => s + c.amount, 0);
    const myPendingLeaves = employeeId
      ? leaves.filter((l) => l.employeeId === employeeId && l.status === 'pending').length
      : 0;

    const cards: StatCard[] = [
      {
        title: t('dash.stat.myAttendance'),
        value: String(presentDays + halfDays),
        hint: t('dash.stat.myAttendanceHint', { present: presentDays, half: halfDays, leave: leaveDays }),
      },
      {
        title: t('dash.stat.myLeaveBalance'),
        value: annualLeft === null ? '—' : t('common.days', { count: annualLeft }),
        hint: balance
          ? t('dash.stat.leaveUsedHint', { used: balance.annualUsed, total: annualTotal, year })
          : t('dash.stat.noLeaveBalance'),
      },
      {
        title: t('dash.stat.myPendingClaims'),
        value: String(myPendingClaims.length),
        hint:
          myPendingClaims.length > 0
            ? t('dash.stat.claimsAwaiting', { amount: fmtRM(pendingClaimsAmount) })
            : myPendingLeaves > 0
              ? t('dash.stat.leaveRequestsPending', { count: myPendingLeaves })
              : t('dash.stat.nothingAwaiting'),
      },
    ];

    return <SummaryLine items={cards.map((c) => ({ label: c.title, value: c.value, hint: c.hint }))} />;
  }

  // ── Admin / HR / Manager: workforce cards scoped to the visible employees ──
  const scopedEmployees = scopeEmployees(employees);
  const scopedAttendance = scopeByEmployee(attendance, (a) => a.employeeId);
  const scopedLeaves = scopeByEmployee(leaves, (l) => l.employeeId);
  const scopedClaims = scopeByEmployee(claims, (c) => c.employeeId);

  const active = scopedEmployees.filter((e) => e.status !== 'resigned');
  const activeIds = new Set(active.map((e) => e.id));
  const onProbation = active.filter((e) => e.status === 'probation').length;

  // Present today — joined to active employees so stale records for resigned
  // staff cannot inflate the count (numerator and hint share the same scope).
  const presentToday = new Set(
    scopedAttendance
      .filter(
        (a) =>
          a.date === today && (a.status === 'present' || a.status === 'half-day') &&
          activeIds.has(a.employeeId),
      )
      .map((a) => a.employeeId),
  ).size;

  const pendingLeaves = scopedLeaves.filter((l) => l.status === 'pending').length;
  const pendingClaims = scopedClaims.filter((c) => c.status === 'submitted').length;
  // Pending OT is bounded to the current month and active staff — older
  // unapproved OT is never paid and has no rejection flow to clear it.
  const pendingOt = scopedAttendance.filter(
    (a) =>
      a.otHours > 0 && !a.otApproved && a.date.startsWith(thisMonth) && activeIds.has(a.employeeId),
  ).length;
  const pendingTotal = pendingLeaves + pendingClaims + pendingOt;

  const cards: StatCard[] = [
    {
      title: t(role === 'Manager' ? 'dash.stat.teamHeadcount' : 'dash.stat.activeHeadcount'),
      value: String(active.length),
      hint: t('dash.stat.headcountHint', {
        probation: onProbation,
        resigned: scopedEmployees.length - active.length,
      }),
    },
    {
      title: t('dash.stat.presentToday'),
      value: String(presentToday),
      hint: t('dash.stat.presentHint', { count: active.length }),
    },
    {
      title: t('dash.stat.pendingApprovals'),
      value: String(pendingTotal),
      hint: t('dash.stat.pendingHint', { leave: pendingLeaves, claims: pendingClaims, ot: pendingOt }),
    },
  ];

  // Payroll cost is company spend — Admin/HR only, never shown to Managers.
  if (role === 'Admin' || role === 'HR') {
    const runThisMonth = runs.find((r) => r.monthKey === thisMonth && r.status === 'finalized');
    const draftThisMonth = runs.find((r) => r.monthKey === thisMonth && r.status === 'draft');
    const latestRun = [...runs].sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0];
    const payrollCost = runThisMonth
      ? runThisMonth.totalEmployerCost
      : estimateMonthlyEmployerCost(scopedEmployees);
    const payrollHint = runThisMonth
      ? t('dash.stat.payrollFinalized', { month: thisMonth, count: runThisMonth.employeeCount })
      : draftThisMonth
        ? t('dash.stat.payrollDraft', { month: thisMonth })
        : latestRun
          ? t('dash.stat.payrollLastRun', {
              month: latestRun.monthKey,
              amount: fmtRM(latestRun.totalEmployerCost),
            })
          : t('dash.stat.payrollNoRun');
    cards.push({
      title: t('dash.stat.payrollCost'),
      value: fmtRM(payrollCost),
      hint: payrollHint,
    });
  }

  return <SummaryLine items={cards.map((c) => ({ label: c.title, value: c.value, hint: c.hint }))} />;
}
