/**
 * Payroll run page (/payroll/runs/:id) — docs/design/payroll-run.html and the
 * "Payroll run page" section of docs/design/DESIGN.md. Top to bottom:
 * breadcrumb, title + status word, the 5-step tracker, 4 totals in plain
 * words, "What to do now", the staff table, and the red "Made a mistake?" box.
 *
 * Staff table: 5 columns by default (Staff, Pay before deductions, Deductions,
 * Take-home pay, Payslip); "Show all details" adds the rest (remembered in
 * localStorage). Staff column and header row stay in place while scrolling.
 * Under 700px wide: one card per person instead of the table.
 *
 * Draft runs: "What to do now" is "Review and approve" (finalize), each row
 * has "Change" (the per-employee adjust dialog), and the bottom box offers
 * "Run this month again" / "Discard this draft" instead of undo.
 *
 * Money columns are display-only re-groupings of the stored payslip fields
 * (./runSummary) — payroll calculations are not changed here. "Pay before
 * deductions" is the payslip's gross; "Claims paid back" (refunds paid with
 * the salary) appears only when at least one row in the run has some.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Check, CircleDashed, Download, FileText,
  List, Pencil, Printer, RotateCcw, Search, Trash2, Undo2, Wallet, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCollection } from '@/lib/db';
import { useRole } from '@/lib/useRole';
import { finalizePayrollRun, runPayroll, undoPayrollRun } from '@/lib/payrollEngine';
import { downloadTextFile } from '@/lib/csv';
import { cn, fmtRM } from '@/lib/utils';
import type {
  AuditLog, Employee, PayrollRun, Payslip, Settings as CompanySettings,
} from '@/lib/types';
import { formatDate } from '@/i18n';
import { greetingName } from '@/pages/dashboard/lib';
import { buttonVariants } from '@/components/ui/button-variants';
import { canSeeSensitive, useAuthSafe } from '@/lib/useAuthSafe';
import { empById } from './helpers';
import StatutoryOutputs from './StatutoryOutputs';
import EmployeeAdjustDialog from './EmployeeAdjustDialog';
import OrgPayrollReport from './OrgPayrollReport';
import { MonthTracker } from './MonthTracker';
import { giroTxt, missingBankDetails } from './bankGiro';
import { hasClaimsBack, summarizePayslip, sumPayslips, type PayslipSummary } from './runSummary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

const DETAILS_KEY = 'myhrms:payrollDetails';

function readDetails(): boolean {
  try {
    return localStorage.getItem(DETAILS_KEY) === '1';
  } catch {
    return false;
  }
}

function saveDetails(on: boolean): void {
  try {
    localStorage.setItem(DETAILS_KEY, on ? '1' : '0');
  } catch {
    /* ignore — the toggle still works for this visit */
  }
}

const money = (n: number) => fmtRM(n);

export default function RunDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role: stubRole } = useRole();
  const auth = useAuthSafe();
  const role = auth?.role ?? stubRole;
  const { items: runs } = useCollection<PayrollRun>('payrollRuns');
  const { items: payslips } = useCollection<Payslip>('payslips');
  const { items: employees } = useCollection<Employee>('employees');
  const { items: settingsItems } = useCollection<CompanySettings>('settings');
  const { items: audit } = useCollection<AuditLog>('audit');
  const [query, setQuery] = useState('');
  const [details, setDetails] = useState(readDetails);
  const [filesOpen, setFilesOpen] = useState(false);
  const [adjustEmpId, setAdjustEmpId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'finalize' | 'undo' | 'rerun' | 'discard'>(null);

  const run = runs.find((r) => r.id === id);
  const empMap = useMemo(() => empById(employees), [employees]);
  const slips = useMemo(() => payslips.filter((p) => p.runId === id), [payslips, id]);
  // IC / bank details are HR-only; managers and employees never see them.
  const showSensitive = canSeeSensitive(auth);
  const me = greetingName(employees.find((e) => e.id === auth?.employeeId)?.name, auth?.user?.username) || String(role);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return slips;
    return slips.filter((p) => {
      const e = empMap.get(p.employeeId);
      return `${e?.name ?? ''} ${e?.ic ?? ''}`.toLowerCase().includes(q);
    });
  }, [slips, empMap, query]);
  // Totals follow the search so the visible rows always foot.
  const totals = useMemo(() => sumPayslips(filtered), [filtered]);
  const allTotals = useMemo(() => sumPayslips(slips), [slips]);

  if (!run) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Wallet className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="font-bold">{t('run.notFoundTitle')}</p>
        <p className="text-muted-foreground">{t('run.notFoundBody')}</p>
        <Button variant="outline" asChild>
          <Link to="/payroll">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" /> {t('run.backToPayroll')}
          </Link>
        </Button>
      </div>
    );
  }

  const isDraft = run.status === 'draft';
  /** A cell of the flat totals panel (take-home highlighted). */
  const totalBox = (main = false) =>
    cn('flex-[1_1_16rem] p-5 shadow-[-1px_-1px_0_0_hsl(var(--border))]', main ? 'bg-accent text-accent-foreground' : 'bg-card');
  const [y, m] = run.monthKey.split('-').map(Number);
  const month = formatDate(new Date(y!, m! - 1, 1), { month: 'long', year: 'numeric' });
  const finalizedBy = [...audit].reverse().find((a) => a.action === 'payroll.finalize' && a.entityId === run.id)?.actorName ?? run.runBy;
  const adjustSlip = adjustEmpId ? slips.find((p) => p.employeeId === adjustEmpId) : undefined;
  const missingBank = missingBankDetails(slips, empMap);
  const nameOf = (p: Payslip) => empMap.get(p.employeeId)?.name ?? p.employeeId;

  const closeConfirm = () => setConfirm(null);
  const doFinalize = () => {
    finalizePayrollRun(run.id, me);
    toast.success(t('run.toastFinalized', { month }), { description: t('run.toastFinalizedDesc') });
    closeConfirm();
  };
  const doUndo = () => {
    if (undoPayrollRun(run.id, me)) {
      toast.success(t('run.toastUndone', { month }));
      navigate('/payroll');
    } else {
      toast.error(t('run.toastUndoFail', { month }));
    }
    closeConfirm();
  };
  const doDiscard = () => {
    if (undoPayrollRun(run.id, me)) {
      toast.success(t('run.toastDiscarded', { month }));
      navigate('/payroll');
    } else {
      toast.error(t('run.toastUndoFail', { month }));
    }
    closeConfirm();
  };
  const doRerun = () => {
    // Same staff as this draft, and still a draft (as the Run payroll wizard does).
    const res = runPayroll(run.monthKey, slips.map((p) => p.employeeId), me, { draft: true });
    toast.success(t('run.toastRerun', { month }));
    closeConfirm();
    navigate(`/payroll/runs/${res.run.id}`, { replace: true });
  };
  const downloadBank = () => {
    const file = `bank-giro-${run.monthKey}.txt`;
    downloadTextFile(file, giroTxt(slips, empMap, settingsItems[0], run.monthKey), 'text/plain');
    toast.success(t('run.toastDownload'), { description: file });
  };
  const toggleDetails = () => {
    setDetails((d) => {
      saveDetails(!d);
      return !d;
    });
  };

  // ── Columns (details adds the rest) ────────────────────────────────────────
  type Col = { key: string; label: string; cell: (p: Payslip, s: PayslipSummary) => ReactNode; total: ReactNode; strong?: boolean };
  const pair = (a: number, b: number) => `${money(a)} / ${money(b)}`;
  const colPayBefore: Col = { key: 'payBefore', label: t('run.colPayBefore'), cell: (_p, s) => money(s.payBefore), total: money(totals.payBefore) };
  const colDeductions: Col = { key: 'deductions', label: t('run.colDeductions'), cell: (_p, s) => money(s.deductions), total: money(totals.deductions) };
  const colTakeHome: Col = { key: 'takeHome', label: t('run.colTakeHome'), cell: (_p, s) => money(s.takeHome), total: money(totals.takeHome), strong: true };
  // Shown only when the run pays back claims or other cash refunds to someone.
  const showClaimsBack = hasClaimsBack(slips);
  const colClaimsBack: Col = { key: 'claimsBack', label: t('run.colClaimsBack'), cell: (_p, s) => money(s.claimsBack), total: money(totals.claimsBack) };
  const claimsBackCols = showClaimsBack ? [colClaimsBack] : [];
  const detailCols: Col[] = [
    { key: 'basic', label: t('run.colBasic'), cell: (p) => money(p.basicPay), total: money(totals.basic) },
    { key: 'allowances', label: t('run.colAllowances'), cell: (p) => money(p.allowances), total: money(totals.allowances) },
    {
      key: 'ot', label: t('run.colOvertime'),
      cell: (p) => (
        <>
          {money(p.otPay)}
          {p.otHours > 0 && <span className="block text-muted-foreground">{t('run.hours', { count: p.otHours })}</span>}
        </>
      ),
      total: money(totals.ot),
    },
    colPayBefore,
    { key: 'epf', label: t('run.colEpf'), cell: (p) => pair(p.epfEmployee, p.epfEmployer), total: pair(totals.epfEe, totals.epfEr) },
    { key: 'socso', label: t('run.colSocso'), cell: (p) => pair(p.socsoEmployee, p.socsoEmployer), total: pair(totals.socsoEe, totals.socsoEr) },
    { key: 'eis', label: t('run.colEis'), cell: (p) => pair(p.eisEmployee, p.eisEmployer), total: pair(totals.eisEe, totals.eisEr) },
    { key: 'pcb', label: t('run.colPcb'), cell: (p) => money(p.pcb), total: money(totals.pcb) },
    { key: 'other', label: t('run.colOther'), cell: (_p, s) => money(s.otherDeductions), total: money(totals.otherDeductions) },
    colDeductions,
    ...claimsBackCols,
    colTakeHome,
    { key: 'cost', label: t('run.colCost'), cell: (p) => money(p.employerCost), total: money(totals.cost) },
  ];
  const cols = details ? detailCols : [colPayBefore, colDeductions, ...claimsBackCols, colTakeHome];

  const badges = (p: Payslip) => (
    <span className="mt-1 flex flex-wrap gap-1">
      {p.salaryTypeUsed === 'daily' && <Badge variant="secondary">{t('run.badgeDaily')}</Badge>}
      {p.salaryTypeUsed === 'hourly' && <Badge variant="secondary">{t('run.badgeHourly')}</Badge>}
      {p.basicOverride !== undefined && <Badge variant="outline" className="border-warning text-warning">{t('run.badgeBasicSet')}</Badge>}
      {(p.adjustmentDeductions ?? 0) + (p.adjustmentEarnings ?? 0) > 0 && (
        <Badge variant="outline" className="border-warning text-warning">{t('run.badgeChanged')}</Badge>
      )}
      {(p.excludeEpf || p.excludeSocso || p.excludeEis || p.excludePcb) && (
        <Badge variant="outline" className="border-destructive text-destructive">{t('run.badgeOptOut')}</Badge>
      )}
    </span>
  );

  const rowActions = (p: Payslip, full = false) => (
    <div className={cn('flex gap-2', full ? 'flex-col' : 'justify-center')}>
      <Button asChild variant="outline" className={cn(full && 'w-full')}>
        <Link to={`/payroll/payslip/${p.id}`} aria-label={t('run.viewFor', { name: nameOf(p) })}>
          {full ? t('run.viewPayslip') : t('run.view')}
        </Link>
      </Button>
      {isDraft && (
        <Button
          variant="outline"
          className={cn(full && 'w-full')}
          aria-label={t('run.changeFor', { name: nameOf(p) })}
          onClick={() => setAdjustEmpId(p.employeeId)}
        >
          <Pencil className="h-5 w-5" aria-hidden="true" /> {t('run.change')}
        </Button>
      )}
    </div>
  );

  const total = filtered.length === slips.length ? slips.length : filtered.length;

  return (
    <div className="space-y-8">
      {/* ── Breadcrumb, title, status ── */}
      <div className="space-y-2">
        <nav aria-label={t('a11y.breadcrumb')}>
          <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
            <li><Link to="/" className="inline-flex min-h-12 items-center hover:underline">{t('bar.home')}</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link to="/go/pay" className="inline-flex min-h-12 items-center hover:underline">{t('group.pay')}</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link to="/payroll" className="inline-flex min-h-12 items-center hover:underline">{t('page.runPayroll.name')}</Link></li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[2rem] font-bold leading-tight">{t('run.title', { month })}</h1>
          {isDraft ? (
            <span className={'inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-3 py-1 font-bold text-warning'}>
              <CircleDashed className="h-5 w-5" aria-hidden="true" /> {t('run.statusNotFinished')}
            </span>
          ) : (
            <span className={'inline-flex items-center gap-1.5 rounded-md bg-success-soft px-3 py-1 font-bold text-success'}>
              <Check className="h-5 w-5" aria-hidden="true" /> {t('run.statusFinished')}
            </span>
          )}
        </div>
        <p className="text-muted-foreground">
          {isDraft
            ? t('run.startedBy', { date: formatDate(run.runAt), name: run.runBy })
            : t('run.finishedBy', { date: formatDate(run.finalizedAt ?? run.runAt), name: finalizedBy })}
        </p>
      </div>

      {/* ── 5-step tracker ── */}
      <MonthTracker runs={runs} run={run} paydayDay={settingsItems[0]?.paydayDay} variant="run" />

      {/* ── Totals (a 5th card when the run pays claims back). Boxes are at least
          16rem and wrap to a new row instead of squeezing, so amounts never wrap. ── */}
      {/* One flat panel; cells wrap to a new row (never squeeze) and are split by thin lines. */}
      <div className="flex flex-wrap overflow-hidden rounded-lg border bg-card">
        <div className={totalBox()}>
          <p className="font-bold">{t('run.staffPaid')}</p>
          <p className="whitespace-nowrap text-[1.6rem] font-bold tabular-nums">{slips.length}</p>
          <p className="text-muted-foreground">{t('run.staffPaidSub')}</p>
        </div>
        <div className={totalBox()}>
          <p className="font-bold">{t('run.totalBefore')}</p>
          <p className="whitespace-nowrap text-[1.6rem] font-bold tabular-nums">{money(allTotals.payBefore)}</p>
          <p className="text-muted-foreground">{t('run.totalBeforeSubGross')}</p>
        </div>
        {allTotals.claimsBack > 0 && (
          <div className={totalBox()}>
            <p className="font-bold">{t('run.colClaimsBack')}</p>
            <p className="whitespace-nowrap text-[1.6rem] font-bold tabular-nums">{money(allTotals.claimsBack)}</p>
            <p className="text-muted-foreground">{t('run.claimsBackSub')}</p>
          </div>
        )}
        <div className={totalBox(true)}>
          <p className="font-bold">{t('run.totalTakeHome')}</p>
          <p className="whitespace-nowrap text-[1.6rem] font-bold tabular-nums">{money(allTotals.takeHome)}</p>
          <p className="text-muted-foreground">{t('run.totalTakeHomeSub')}</p>
        </div>
        <div className={totalBox()}>
          <p className="font-bold">{t('run.totalCost')}</p>
          <p className="whitespace-nowrap text-[1.6rem] font-bold tabular-nums">{money(allTotals.cost)}</p>
          <p className="text-muted-foreground">{t('run.totalCostSub')}</p>
        </div>
      </div>

      {/* ── What to do now ── */}
      <section aria-labelledby="run-what-now" className="space-y-3">
        <h2 id="run-what-now" className="text-[1.35rem] font-bold">{t('run.whatNow')}</h2>
        {isDraft ? (
          <>
            <p>{t('run.draftHelp')}</p>
            <Button onClick={() => setConfirm('finalize')}>
              <BadgeCheck className="h-5 w-5" aria-hidden="true" /> {t('run.reviewApprove')}
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Button onClick={downloadBank}>
                <Download className="h-5 w-5" aria-hidden="true" /> {t('run.downloadBank')}
              </Button>
              <Button asChild variant="outline">
                <Link to={`/payroll/batch-payslips?run=${run.id}`}>
                  <Printer className="h-5 w-5" aria-hidden="true" /> {t('run.printAll')}
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setFilesOpen(true)}>
                <FileText className="h-5 w-5" aria-hidden="true" /> {t('run.statutoryFiles')}
              </Button>
            </div>
            {missingBank.length > 0 && (
              <p className="flex items-start gap-2 text-warning">
                <AlertTriangle className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
                {t('run.bankMissing', { count: missingBank.length, names: missingBank.map(nameOf).join(', ') })}
              </p>
            )}
          </>
        )}
      </section>

      {run.warnings.length > 0 && (
        <Alert className="border-warning/40 bg-warning-soft">
          <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
          <AlertTitle className="font-bold text-warning">{t('run.warnings', { count: run.warnings.length })}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {run.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Staff table / cards ── */}
      <section aria-labelledby="run-pay-each" className="space-y-4">
        <h2 id="run-pay-each" className="text-[1.35rem] font-bold">{t('run.payEach')}</h2>
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-[16rem] flex-1">
            <span className="sr-only">{t('run.search')}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('run.search')}
              className={'h-12 w-full rounded-md border-2 border-input bg-card pl-12 pr-4 text-card-foreground placeholder:text-muted-foreground'}
            />
          </label>
          <Button
            variant={details ? 'default' : 'outline'}
            aria-pressed={details}
            onClick={toggleDetails}
            className="h-12"
          >
            <List className="h-5 w-5" aria-hidden="true" /> {details ? t('run.showFewer') : t('run.showAll')}
          </Button>
        </div>

        {slips.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed p-8 text-center font-bold">{t('run.noSlips')}</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center">
            <p>{t('run.noneMatch', { query: query.trim() })}</p>
            <Button variant="outline" onClick={() => setQuery('')}>
              <X className="h-5 w-5" aria-hidden="true" /> {t('run.clearSearch')}
            </Button>
          </div>
        ) : (
          <>
            {/* 700px and wider: table. With details off it shows in full on the
                page; with details on it scrolls in its own box, Staff column and
                header row fixed. */}
            <div
              data-testid="run-table"
              className={cn(
                'hidden overflow-x-auto bg-card min-[700px]:block',
                'rounded-lg border',
                details && 'max-h-[75vh] overflow-y-auto',
              )}
            >
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 top-0 z-30 min-w-[15rem] border-b-2 border-r bg-muted px-4 py-3 font-bold">
                      {t('run.colStaff')}
                    </th>
                    {cols.map((c) => (
                      <th key={c.key} scope="col" className="sticky top-0 z-20 border-b-2 bg-muted px-4 py-3 text-right font-bold">
                        {c.label}
                      </th>
                    ))}
                    <th scope="col" className="sticky top-0 z-20 border-b-2 bg-muted px-4 py-3 text-center font-bold">
                      {t('run.colPayslip')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const s = summarizePayslip(p);
                    const e = empMap.get(p.employeeId);
                    return (
                      <tr key={p.id}>
                        <th scope="row" className="sticky left-0 z-10 border-b border-r bg-card px-4 py-3 text-left align-top font-normal">
                          <span className="block font-bold">{nameOf(p)}</span>
                          {showSensitive && e?.ic && <span className="block whitespace-nowrap text-muted-foreground">{t('run.ic', { ic: e.ic })}</span>}
                          {badges(p)}
                        </th>
                        {cols.map((c) => (
                          <td key={c.key} className={cn('whitespace-nowrap border-b px-4 py-3 text-right align-middle tabular-nums', c.strong && 'font-bold')}>
                            {c.cell(p, s)}
                          </td>
                        ))}
                        <td className="border-b px-4 py-2 align-middle">{rowActions(p)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="sticky left-0 z-10 border-r bg-muted px-4 py-3 text-left font-bold">
                      {t('run.total', { count: total })}
                    </th>
                    {cols.map((c) => (
                      <td key={c.key} className="whitespace-nowrap bg-muted px-4 py-3 text-right font-bold tabular-nums">{c.total}</td>
                    ))}
                    <td className="bg-muted" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Under 700px: one card per person */}
            <ul className="space-y-4 min-[700px]:hidden">
              {filtered.map((p) => {
                const s = summarizePayslip(p);
                const e = empMap.get(p.employeeId);
                return (
                  <li key={p.id} className="space-y-3 rounded-lg border bg-card p-4">
                    <div>
                      <p className="font-bold">{nameOf(p)}</p>
                      {showSensitive && e?.ic && <p className="text-muted-foreground">{t('run.ic', { ic: e.ic })}</p>}
                      {badges(p)}
                    </div>
                    <dl className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt>{t('run.colTakeHome')}</dt>
                        <dd className="text-[1.35rem] font-bold tabular-nums">{money(s.takeHome)}</dd>
                      </div>
                      {(details ? detailCols.filter((c) => c.key !== 'takeHome') : [colPayBefore, colDeductions, colClaimsBack])
                        // Claims paid back: one extra line, only when this person has some.
                        .filter((c) => c.key !== 'claimsBack' || s.claimsBack > 0)
                        .map((c) => (
                        <div key={c.key} className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground">{c.label}</dt>
                          <dd className="text-right tabular-nums">{c.cell(p, s)}</dd>
                        </div>
                      ))}
                    </dl>
                    {rowActions(p, true)}
                  </li>
                );
              })}
              <li className="flex items-baseline justify-between gap-3 rounded-xl bg-muted p-4 font-bold">
                <span>{t('run.totalTakeHomeShort', { count: total })}</span>
                <span className="tabular-nums">{money(totals.takeHome)}</span>
              </li>
            </ul>
          </>
        )}
      </section>

      {/* ── Bottom box: undo (finished) or start again (draft) ── */}
      {isDraft ? (
        <section aria-labelledby="run-start-again" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5">
          <div className="space-y-1">
            <h2 id="run-start-again" className="font-bold">{t('run.startAgainTitle')}</h2>
            <p className="text-muted-foreground">{t('run.startAgainBody')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setConfirm('rerun')}>
              <RotateCcw className="h-5 w-5" aria-hidden="true" /> {t('run.rerun')}
            </Button>
            <Button variant="destructive" onClick={() => setConfirm('discard')}>
              <Trash2 className="h-5 w-5" aria-hidden="true" /> {t('run.discard')}
            </Button>
          </div>
        </section>
      ) : (
        <section aria-labelledby="run-mistake" className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-danger-soft p-5">
          <div className="space-y-1">
            <h2 id="run-mistake" className="font-bold">{t('run.mistakeTitle')}</h2>
            <p>{t('run.mistakeBody')}</p>
          </div>
          <Button variant="destructive" onClick={() => setConfirm('undo')}>
            <Undo2 className="h-5 w-5" aria-hidden="true" /> {t('run.undoRun')}
          </Button>
        </section>
      )}

      {/* ── EPF / SOCSO / EIS / PCB files ── */}
      <Sheet open={filesOpen} onOpenChange={setFilesOpen}>
        <SheetContent side="right" showClose={false} className="w-full gap-4 overflow-y-auto p-6 sm:max-w-4xl">
          <SheetHeader className="p-0">
            <SheetTitle className="text-[1.5rem] font-bold">{t('run.statutoryFiles')}</SheetTitle>
            <SheetDescription className="text-base">{t('run.statutoryDesc')}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-wrap gap-3">
            <OrgPayrollReport run={run} />
            <SheetClose asChild>
              <Button variant="outline">
                <X className="h-5 w-5" aria-hidden="true" /> {t('help.close')}
              </Button>
            </SheetClose>
          </div>
          <StatutoryOutputs run={run} slips={slips} empMap={empMap} settings={settingsItems[0]} />
        </SheetContent>
      </Sheet>

      {/* Per-employee editor (draft runs only) */}
      <EmployeeAdjustDialog
        open={adjustEmpId !== null}
        onOpenChange={(o) => !o && setAdjustEmpId(null)}
        runId={run.id}
        payslip={adjustSlip}
        employee={adjustEmpId ? empMap.get(adjustEmpId) : undefined}
        actor={me}
        onChanged={() => {/* collections are reactive — re-render happens automatically */}}
        onExcluded={() => setAdjustEmpId(null)}
      />

      {/* ── Confirm dialogs ── */}
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && closeConfirm()}>
        <AlertDialogContent>
          {confirm === 'finalize' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-primary" aria-hidden="true" /> {t('run.finalizeTitle', { month })}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>{t('run.finalizeBody1', { count: slips.length, amount: money(allTotals.takeHome) })}</p>
                    <p>{t('run.finalizeBody2')}</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('run.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={doFinalize}>{t('run.finalizeYes')}</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm === 'undo' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" /> {t('run.undoTitle', { month })}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>{t('run.undoLose')}</p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>{t('run.undoLose1', { month, count: slips.length, amount: money(allTotals.takeHome) })}</li>
                      <li>{t('run.undoLose2')}</li>
                      <li>{t('run.undoLose3')}</li>
                    </ul>
                    <p>{t('run.undoYtd')}</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('run.keep')}</AlertDialogCancel>
                <AlertDialogAction onClick={doUndo} className={buttonVariants({ variant: 'destructive' })}>
                  <Undo2 className="h-5 w-5" aria-hidden="true" /> {t('run.undoYes')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm === 'rerun' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('run.rerunTitle', { month })}</AlertDialogTitle>
                <AlertDialogDescription>{t('run.rerunBody')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('run.keep')}</AlertDialogCancel>
                <AlertDialogAction onClick={doRerun}>
                  <RotateCcw className="h-5 w-5" aria-hidden="true" /> {t('run.rerunYes')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm === 'discard' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" /> {t('run.discardTitle', { month })}
                </AlertDialogTitle>
                <AlertDialogDescription>{t('run.discardBody', { count: slips.length })}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('run.keep')}</AlertDialogCancel>
                <AlertDialogAction onClick={doDiscard} className={buttonVariants({ variant: 'destructive' })}>
                  <Trash2 className="h-5 w-5" aria-hidden="true" /> {t('run.discardYes')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
