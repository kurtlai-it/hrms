/**
 * M8 — Reports center (/reports).
 * Five operational reports with on-screen previews and CSV download:
 * headcount, attendance summary, leave liability, payroll register and a
 * statutory compliance checklist.
 *
 * Role scoping (via useAuth — see src/lib/authContext.tsx):
 *   - Admin / HR → all five reports; only HR can trigger a payroll run from
 *     the register's empty state.
 *   - Manager    → headcount / attendance / leave only, scoped to their own
 *     department; payroll register and compliance are hidden.
 *   - Employee   → no reports (access guard card).
 * Until AuthProvider is wired into App.tsx (integration wave) the page falls
 * back to the pre-auth demo behavior (unrestricted Admin view).
 */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n';
import {
  CalendarCheck,
  Download,
  FileSpreadsheet,
  PieChart,
  Play,
  ShieldAlert,
  ShieldCheck,
  Umbrella,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCollection } from '@/lib/db';
import { runPayroll } from '@/lib/payrollEngine';
import { useAuth, type AuthContextValue } from '@/lib/useAuth';
import type { AuthRole } from '@/lib/auth';
import type { DepartmentProfile } from '@/lib/orgChart';
import { cn, monthKey } from '@/lib/utils';
import type {
  AttendanceRecord,
  Department,
  Employee,
  LeaveBalance,
  PayrollRun,
  Payslip,
  Settings,
  Shift,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  buildAttendanceReport,
  buildComplianceReport,
  buildDeptCostRollup,
  buildHeadcountReport,
  buildLeaveLiabilityReport,
  buildPayrollRegisterReport,
  type BuiltReport,
  type DeptCostRow,
} from './reportBuilders';
import { downloadCsv } from '@/lib/csv';
import { reportCsv } from './csv';
import ReportPreview from './ReportPreview';
import DeptCostChart from './DeptCostChart';
import ReportsOverview from './overview/ReportsOverview';

/**
 * useAuth with a fallback for the pre-integration window: AuthProvider is
 * wired into App.tsx in a later wave, so until then useAuth() throws (no
 * provider). Returning null lets the page fall back to the pre-auth demo
 * behavior (unrestricted Admin view).
 */
function useReportsAuth(): AuthContextValue | null {
  try {
    // useContext inside useAuth always runs before the no-provider throw, so
    // hook order stays stable across the try/catch.
    return useAuth();
  } catch {
    return null;
  }
}

type ReportId = 'headcount' | 'attendance' | 'leave' | 'payroll' | 'dept-cost' | 'compliance';

/** Titles and descriptions: locale keys reports.meta.<id>.title / .desc */
interface ReportMeta {
  id: ReportId;
  icon: LucideIcon;
  needsMonth?: boolean;
}

const REPORT_META: ReportMeta[] = [
  { id: 'headcount', icon: Users },
  { id: 'attendance', icon: CalendarCheck, needsMonth: true },
  { id: 'leave', icon: Umbrella },
  { id: 'payroll', icon: Wallet, needsMonth: true },
  { id: 'dept-cost', icon: PieChart, needsMonth: true },
  { id: 'compliance', icon: ShieldCheck },
];

/** 'YYYY-MM' -> 'October 2026' in the UI language. */
function monthName(mk: string): string {
  const [y, m] = mk.split('-').map(Number);
  return formatDate(new Date(y!, m! - 1, 1), { month: 'long', year: 'numeric' });
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const auth = useReportsAuth();
  /** Pre-integration (no AuthProvider yet) the demo stays unrestricted (Admin). */
  const role: AuthRole | null = auth ? auth.role : 'Admin';
  const isStaffRole = role === 'Admin' || role === 'HR';

  const { items: employees } = useCollection<Employee>('employees');
  const { items: departments } = useCollection<Department>('departments');
  const { items: attendance } = useCollection<AttendanceRecord>('attendance');
  const { items: shifts } = useCollection<Shift>('shifts');
  const { items: leaveBalances } = useCollection<LeaveBalance>('leaveBalances');
  const { items: payslips } = useCollection<Payslip>('payslips');
  const { items: runs } = useCollection<PayrollRun>('payrollRuns');
  const { items: settings } = useCollection<Settings>('settings');
  const { items: deptProfiles } = useCollection<DepartmentProfile>('departmentProfiles');

  const [selected, setSelected] = useState<ReportId>('headcount');
  const [month, setMonth] = useState(monthKey());
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(timer);
  }, []);

  /** Data scoping: Admin/HR see everything; Managers their own department only. */
  const scopeEmployees = useMemo(
    () => auth?.scopeEmployees ?? ((list: Employee[]) => list),
    [auth],
  );
  const scopeByEmployee = useMemo(
    () => auth?.scopeByEmployee ?? (<T,>(list: T[]): T[] => list),
    [auth],
  );
  const scopedEmployees = useMemo(() => scopeEmployees(employees), [employees, scopeEmployees]);
  const scopedAttendance = useMemo(
    () => scopeByEmployee(attendance, (a) => a.employeeId),
    [attendance, scopeByEmployee],
  );
  const scopedLeaveBalances = useMemo(
    () => scopeByEmployee(leaveBalances, (b) => b.employeeId),
    [leaveBalances, scopeByEmployee],
  );
  const scopedPayslips = useMemo(
    () => scopeByEmployee(payslips, (p) => p.employeeId),
    [payslips, scopeByEmployee],
  );

  /** Payroll register, dept cost rollup + statutory compliance are Admin/HR-only. */
  const visibleMeta = useMemo(
    () =>
      REPORT_META.filter(
        (m) => (m.id !== 'payroll' && m.id !== 'dept-cost' && m.id !== 'compliance') || isStaffRole,
      ),
    [isStaffRole],
  );

  // Keep the selection valid when the visible set shrinks (e.g. Manager login).
  useEffect(() => {
    if (visibleMeta.length > 0 && !visibleMeta.some((m) => m.id === selected)) {
      setSelected(visibleMeta[0].id);
    }
  }, [visibleMeta, selected]);

  /** Months that carry data, newest first; always includes current + previous. */
  const months = useMemo(() => {
    const set = new Set<string>();
    attendance.forEach((a) => set.add(a.date.slice(0, 7)));
    payslips.forEach((p) => set.add(p.monthKey));
    runs.forEach((r) => set.add(r.monthKey));
    set.add(monthKey());
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    set.add(monthKey(prev));
    return [...set].sort().reverse();
  }, [attendance, payslips, runs]);

  const buildById = useCallback((id: ReportId): BuiltReport => {
    switch (id) {
      case 'attendance':
        return buildAttendanceReport(month, scopedEmployees, departments, scopedAttendance, shifts);
      case 'leave':
        return buildLeaveLiabilityReport(new Date().getFullYear(), scopedEmployees, departments, scopedLeaveBalances);
      case 'payroll':
        return buildPayrollRegisterReport(month, scopedEmployees, departments, scopedPayslips);
      case 'dept-cost':
        return buildDeptCostRollup(month, scopedEmployees, departments, deptProfiles, scopedPayslips, runs);
      case 'compliance':
        return buildComplianceReport({ employees: scopedEmployees, attendance: scopedAttendance, payslips: scopedPayslips, runs, settings, today: new Date() });
      default:
        return buildHeadcountReport(scopedEmployees, departments);
    }
  }, [month, scopedEmployees, departments, deptProfiles, scopedAttendance, shifts, scopedLeaveBalances, scopedPayslips, runs, settings]);

  const report = useMemo(() => buildById(selected), [selected, buildById]);

  const meta = visibleMeta.find((m) => m.id === selected) ?? visibleMeta[0];
  // Seed-flash guard: also treat "seed flag absent" as loading so the empty
  // state never flashes while the async demo seed is still landing.
  const seeded =
    typeof localStorage !== 'undefined' && localStorage.getItem('myhrms:seeded:v1') !== null;
  const loading = employees.length === 0 && (!ready || !seeded);

  const handleDownload = (r: BuiltReport) => downloadCsv(r.filename, reportCsv(r));

  const handleRunPayroll = () => {
    setRunning(true);
    try {
      runPayroll(month, undefined, auth?.user?.username ?? 'HR (reports demo)');
    } finally {
      setRunning(false);
    }
  };

  // Employees (and logged-out sessions once auth is wired) get no reports.
  if (role !== 'Admin' && role !== 'HR' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('reports.title')}</h1>
        </div>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlert />
            </EmptyMedia>
            <EmptyTitle>{t('reports.noAccessTitle')}</EmptyTitle>
            <EmptyDescription>{t('reports.noAccessBody')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSpreadsheet />
          </EmptyMedia>
          <EmptyTitle>{t('reports.noDataTitle')}</EmptyTitle>
          <EmptyDescription>{t('reports.noDataBody')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('reports.title')}</h1>
        <p className="text-muted-foreground">{t('reports.intro')}</p>
        {role === 'Manager' && (
          <p className="font-medium text-primary">{t('reports.managerScope')}</p>
        )}
      </div>

      {/* Report list: one row per report; the open one shows below. */}
      <section aria-labelledby="report-list" className="space-y-2">
        <h2 id="report-list" className="text-[1.2rem] font-bold">{t('reports.listTitle')}</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('reports.colReport')}</TableHead>
              <TableHead>{t('reports.colShows')}</TableHead>
              <TableHead><span className="sr-only">{t('reports.colActions')}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleMeta.map((m) => (
              <TableRow key={m.id} className={cn(selected === m.id && 'bg-accent')}>
                <TableCell className="font-bold">{t(`reports.meta.${m.id}.title`)}</TableCell>
                <TableCell className="whitespace-normal">{t(`reports.meta.${m.id}.desc`)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2 lg:flex-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      aria-pressed={selected === m.id}
                      onClick={() => setSelected(m.id)}
                    >
                      {t('reports.openReport')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('reports.downloadCsvFor', { title: t(`reports.meta.${m.id}.title`) })}
                      onClick={() => handleDownload(buildById(m.id))}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      {t('reports.csv')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {/* Cross-period salary analysis — its own page (Admin/HR only). */}
            {isStaffRole && (
              <TableRow>
                <TableCell className="font-bold">{t('reports.salaryTitle')}</TableCell>
                <TableCell className="whitespace-normal">{t('reports.salaryDesc')}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/reports/salary">{t('reports.openSalary')}</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* Preview */}
      <Card className="rounded-xl">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">{t(`reports.meta.${selected}.title`)}</CardTitle>
              <CardDescription>
                {t('reports.rows', { count: report.rows.length })}
                {meta.needsMonth ? ` · ${monthName(month)}` : ''}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {meta.needsMonth && (
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={t('reports.month')} />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((mk) => (
                      <SelectItem key={mk} value={mk}>
                        {monthName(mk)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" variant="outline" onClick={() => handleDownload(report)}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t('reports.downloadCsv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selected === 'payroll' && report.rows.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Wallet />
                </EmptyMedia>
                <EmptyTitle>{t('reports.noPayslipsTitle', { month: monthName(month) })}</EmptyTitle>
                <EmptyDescription>
                  {role === 'HR'
                    ? t('reports.noPayslipsHR')
                    : t('reports.noPayslipsOther', { month: monthName(month) })}
                </EmptyDescription>
              </EmptyHeader>
              {role === 'HR' && (
                <EmptyContent>
                  <Button onClick={handleRunPayroll} disabled={running} disabledReason={false}>
                    <Play className="mr-1.5 h-4 w-4" />
                    {running ? t('reports.running') : t('reports.runFor', { month: monthName(month) })}
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : report.rows.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileSpreadsheet />
                </EmptyMedia>
                <EmptyTitle>{t('reports.nothingTitle')}</EmptyTitle>
                <EmptyDescription>{t('reports.nothingBody')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {selected === 'dept-cost' && (
                <DeptCostChart rows={report.rows as DeptCostRow[]} />
              )}
              <ReportPreview report={report} />
            </>
          )}
          {report.note && (
            <p className="text-muted-foreground">
              {t(`reports.note.${selected}`, { year: new Date().getFullYear(), month: monthName(month) })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Headline figures, charts and deadlines, after the reports themselves. */}
      <ReportsOverview />
    </div>
  );
}
