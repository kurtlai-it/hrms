/**
 * Approval workflow — the leave waiting for a decision as a table (staff
 * member, leave, dates, days, reason, Approve / Reject), then the recent
 * decisions (first five, "Show all"), with a cancel flow for approved leave.
 *
 * Access (QA B2): Admin/HR decide everything; Managers decide their own
 * department (rows are scoped via mock auth); Employees have no approval
 * access. A user can never decide or cancel their OWN request.
 * Balance handling: approving a tracked type (annual / sick / hospitalization)
 * increments the used column of the employee's balance row for the leave year
 * (created from EA entitlements first when missing); cancelling restores it.
 * QA B5: the live balance is re-validated at approval time — an approval that
 * would push the balance negative is blocked with a clear error.
 * QA B6: approved leave can be cancelled before its start date; the tracked
 * days are returned to the balance and the cancel is audited.
 */
import { OwnRequestNote } from '@/components/OwnRequestNote';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { leaveDecidedMessage } from '@/lib/decisionMessages';
import { useMemo, useState } from 'react';
import { Ban, Check, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit, type CollectionApi } from '@/lib/db';
import { fmtDate } from '@/lib/utils';
import type { Employee, LeaveBalance, LeaveStatus } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  balanceFor, balanceView, effectiveBalance, entitlementColumns, pendingDaysFor, toISO,
  usagePatch, LEAVE_TYPE_META, type LeaveRequestEx,
} from '../leaveLogic';
import { useAuthScope } from '../useAuthScope';

interface Props {
  employees: Employee[];
  leavesApi: CollectionApi<LeaveRequestEx>;
  balancesApi: CollectionApi<LeaveBalance>;
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  const { t } = useTranslation();
  const cls: Record<LeaveStatus, string> = {
    pending: 'bg-warning-soft text-warning',
    approved: 'bg-success-soft text-success',
    rejected: 'bg-danger-soft text-destructive',
    cancelled: 'bg-secondary text-muted-foreground',
  };
  return (
    <Badge variant="secondary" className={cls[status]}>
      {t(`leaveQ.status_${status}`)}
    </Badge>
  );
}

interface Decision {
  request: LeaveRequestEx;
  action: 'approved' | 'rejected';
}

export default function ApprovalsQueue({ employees, leavesApi, balancesApi }: Props) {
  const auth = useAuthScope();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [cancelReq, setCancelReq] = useState<LeaveRequestEx | null>(null);
  const [remarks, setRemarks] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const { t } = useTranslation();

  const todayISO = toISO(new Date());

  const empName = useMemo(() => {
    const map = new Map(employees.map((e) => [e.id, e]));
    return (id: string) => map.get(id);
  }, [employees]);

  // B2 — never let the acting user decide/cancel their own request.
  const isSelf = (l: LeaveRequestEx) => auth.employeeId != null && l.employeeId === auth.employeeId;

  // B2 — scope rows by role: Admin/HR all, Manager own department, Employee own.
  const scopedLeaves = useMemo(
    () => auth.scopeByEmployee(leavesApi.items, (l) => l.employeeId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leavesApi.items, auth.scopeByEmployee],
  );

  const sorted = useMemo(
    () => [...scopedLeaves].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)),
    [scopedLeaves],
  );
  const pending = sorted.filter((l) => l.status === 'pending');
  const history = sorted.filter((l) => l.status !== 'pending');

  // B5 — live balance revalidation for an approval dialog (tracked types).
  const approvalCheck = useMemo(() => {
    if (!decision || decision.action !== 'approved') return null;
    const req = decision.request;
    const emp = empName(req.employeeId);
    if (!emp) return null;
    const year = Number(req.startDate.slice(0, 4));
    const bal = effectiveBalance(emp, balancesApi.items, year);
    const otherPending = pendingDaysFor(leavesApi.items, req.employeeId, req.type, year, req.id);
    const view = balanceView(bal, req.type, otherPending);
    if (!view.tracked) return null;
    return { view, ok: req.days <= view.available };
  }, [decision, empName, balancesApi.items, leavesApi.items]);

  // B2 — Employees (and unknown roles) never reach the approval workflow.
  if (!auth.canApprove) {
    return (
      <Card className="rounded-xl">
        <CardContent className="pt-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldAlert className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>No approval access</EmptyTitle>
              <EmptyDescription>
                Leave approvals are restricted to Admin, HR and Managers. Your own requests appear
                here once submitted — decisions are made by your approver.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const confirmDecision = () => {
    if (!decision) return;
    const { request, action } = decision;
    if (isSelf(request)) return; // buttons are hidden — belt & braces
    if (action === 'approved' && approvalCheck && !approvalCheck.ok) return; // B5 block
    const decidedAt = new Date().toISOString();
    leavesApi.update(request.id, {
      status: action,
      decidedBy: auth.actor,
      decidedAt,
      decisionRemarks: remarks.trim() || undefined,
    });

    if (action === 'approved') {
      const year = Number(request.startDate.slice(0, 4));
      const emp = empName(request.employeeId);
      let bal = balanceFor(balancesApi.items, request.employeeId, year);
      if (!bal && emp) {
        bal = balancesApi.add({
          employeeId: request.employeeId,
          year,
          ...entitlementColumns(emp, year),
          annualUsed: 0,
          sickUsed: 0,
          hospitalizationUsed: 0,
          carriedForward: 0,
        });
      }
      if (bal) {
        balancesApi.update(bal.id, usagePatch(bal, request.type, request.days));
      }
    }

    const name = empName(request.employeeId)?.name ?? request.employeeId;
    logAudit({
      actorName: auth.actor,
      action: action === 'approved' ? 'leave.approve' : 'leave.reject',
      entity: 'leaves',
      entityId: request.id,
      detail: `${name} — ${LEAVE_TYPE_META[request.type].label} ${request.days}d (${request.startDate} → ${request.endDate})${remarks.trim() ? ` · ${remarks.trim()}` : ''}`,
    });
    toast.success(leaveDecidedMessage(name, action === 'approved', request.startDate, request.endDate, request.days));
    setDecision(null);
    setRemarks('');
  };

  // B6 — cancel an approved request before it starts; restore the balance.
  const confirmCancel = () => {
    if (!cancelReq) return;
    if (isSelf(cancelReq)) return;
    leavesApi.update(cancelReq.id, {
      status: 'cancelled',
      decisionRemarks: remarks.trim()
        ? `Cancelled: ${remarks.trim()}`
        : cancelReq.decisionRemarks,
    });
    const year = Number(cancelReq.startDate.slice(0, 4));
    const bal = balanceFor(balancesApi.items, cancelReq.employeeId, year);
    if (bal) {
      balancesApi.update(bal.id, usagePatch(bal, cancelReq.type, -cancelReq.days));
    }
    const name = empName(cancelReq.employeeId)?.name ?? cancelReq.employeeId;
    logAudit({
      actorName: auth.actor,
      action: 'leave.cancel',
      entity: 'leaves',
      entityId: cancelReq.id,
      detail: `${name} — ${LEAVE_TYPE_META[cancelReq.type].label} ${cancelReq.days}d (${cancelReq.startDate} → ${cancelReq.endDate}) cancelled; ${cancelReq.days}d restored to balance${remarks.trim() ? ` · ${remarks.trim()}` : ''}`,
    });
    toast.success(`Leave cancelled for ${name} — ${cancelReq.days}d restored to balance`);
    setCancelReq(null);
    setRemarks('');
  };

  // Who decided: the staff member's name when the id is a staff record.
  const deciderName = (id?: string) => (id ? employees.find((e) => e.id === id)?.name ?? id : '—');
  const range = (l: LeaveRequestEx) =>
    l.startDate === l.endDate ? fmtDate(l.startDate) : t('leaveQ.range', { from: fmtDate(l.startDate), to: fmtDate(l.endDate) });
  const typeBadge = (l: LeaveRequestEx) => (
    <Badge variant="secondary" className={cn(LEAVE_TYPE_META[l.type].chip)}>
      {LEAVE_TYPE_META[l.type].label}
    </Badge>
  );
  const shownHistory = showAllHistory ? history : history.slice(0, 5);

  return (
    <div className="space-y-8">
      <section aria-labelledby="leave-pending" className="space-y-2">
        <h2 id="leave-pending" className="text-[1.2rem] font-bold">
          {t('leaveQ.pendingTitle')} <span className="font-normal text-muted-foreground">({pending.length})</span>
        </h2>
        <p className="text-muted-foreground">
          {t('leaveQ.pendingIntro')}
          {auth.role === 'Manager' ? ` ${t('leaveQ.ownDept')}` : ''}
        </p>
        {pending.length === 0 ? (
          <p className="border-y py-3">{t('leaveQ.none')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('leaveQ.colName')}</TableHead>
                <TableHead>{t('leaveQ.colType')}</TableHead>
                <TableHead>{t('leaveQ.colDates')}</TableHead>
                <TableHead className="text-right">{t('leaveQ.colDays')}</TableHead>
                <TableHead>{t('leaveQ.colReason')}</TableHead>
                <TableHead><span className="sr-only">{t('leaveQ.colActions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-bold">{empName(l.employeeId)?.name ?? l.employeeId}</TableCell>
                  <TableCell>{typeBadge(l)}</TableCell>
                  <TableCell>
                    {range(l)}
                    <p className="text-muted-foreground">{t('leaveQ.applied', { date: fmtDate(l.appliedAt) })}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.days}
                    {l.halfDay && <p className="text-muted-foreground">{t('leaveQ.halfDay')}</p>}
                  </TableCell>
                  <TableCell className="whitespace-normal">{l.reason}</TableCell>
                  <TableCell>
                    {isSelf(l) ? (
                      <OwnRequestNote />
                    ) : (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" onClick={() => setDecision({ request: l, action: 'approved' })}>
                          <Check className="h-4 w-4" aria-hidden /> {t('leaveQ.approve')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDecision({ request: l, action: 'rejected' })}>
                          <X className="h-4 w-4" aria-hidden /> {t('leaveQ.reject')}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="leave-history" className="space-y-2">
        <h2 id="leave-history" className="text-[1.2rem] font-bold">{t('leaveQ.historyTitle')}</h2>
        <p className="text-muted-foreground">{t('leaveQ.historyIntro')}</p>
        {history.length === 0 ? (
          <p className="border-y py-3">{t('leaveQ.historyNone')}</p>
        ) : (
          <>
            <Table id="leave-history-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('leaveQ.colName')}</TableHead>
                  <TableHead>{t('leaveQ.colType')}</TableHead>
                  <TableHead>{t('leaveQ.colDates')}</TableHead>
                  <TableHead className="text-right">{t('leaveQ.colDays')}</TableHead>
                  <TableHead>{t('leaveQ.colDecision')}</TableHead>
                  <TableHead><span className="sr-only">{t('leaveQ.colActions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownHistory.map((l) => {
                  const cancellable = l.status === 'approved' && l.startDate > todayISO && !isSelf(l);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-bold">{empName(l.employeeId)?.name ?? l.employeeId}</TableCell>
                      <TableCell>{typeBadge(l)}</TableCell>
                      <TableCell>{range(l)}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.days}</TableCell>
                      <TableCell className="whitespace-normal">
                        <StatusBadge status={l.status} />
                        {l.decidedAt && (
                          <p className="text-muted-foreground">
                            {t('leaveQ.decidedBy', { name: deciderName(l.decidedBy), date: fmtDate(l.decidedAt) })}
                          </p>
                        )}
                        {l.decisionRemarks && (
                          <p className="text-muted-foreground">{t('leaveQ.remark', { text: l.decisionRemarks })}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {cancellable && (
                          <div className="flex justify-end">
                            <Button size="sm" variant="outline" onClick={() => { setCancelReq(l); setRemarks(''); }}>
                              <Ban className="h-4 w-4" aria-hidden /> {t('leaveQ.cancel')}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {history.length > 5 && (
              <Button
                variant="outline"
                aria-expanded={showAllHistory}
                aria-controls="leave-history-table"
                onClick={() => setShowAllHistory((v) => !v)}
              >
                {showAllHistory ? t('leaveQ.showFewer') : t('leaveQ.showAll', { count: history.length })}
              </Button>
            )}
          </>
        )}
      </section>

      {/* Approve / reject dialog */}
      <Dialog open={decision !== null} onOpenChange={(open) => { if (!open) { setDecision(null); setRemarks(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.action === 'approved' ? 'Approve' : 'Reject'} leave request
            </DialogTitle>
            <DialogDescription>
              {decision && (
                <>
                  {empName(decision.request.employeeId)?.name} — {LEAVE_TYPE_META[decision.request.type].label},{' '}
                  {fmtDate(decision.request.startDate)} → {fmtDate(decision.request.endDate)} ({decision.request.days} day(s)).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {approvalCheck && !approvalCheck.ok && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Cannot approve — insufficient balance. {approvalCheck.view.available} day(s) available
                (after {approvalCheck.view.pending} pending), {decision?.request.days} requested.
                Approving would push the balance negative; reject or ask the employee to revise.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="decision-remarks">Remarks (optional)</Label>
            <Textarea
              id="decision-remarks"
              placeholder="e.g. Approved — cover arranged with team lead."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDecision(null); setRemarks(''); }}>
              Cancel
            </Button>
            <Button
              variant={decision?.action === 'rejected' ? 'destructive' : 'default'}
              disabled={Boolean(approvalCheck && !approvalCheck.ok)}
              onClick={confirmDecision}
            >
              Confirm {decision?.action === 'approved' ? 'approval' : 'rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel approved leave dialog */}
      <Dialog open={cancelReq !== null} onOpenChange={(open) => { if (!open) { setCancelReq(null); setRemarks(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel approved leave</DialogTitle>
            <DialogDescription>
              {cancelReq && (
                <>
                  {empName(cancelReq.employeeId)?.name} — {LEAVE_TYPE_META[cancelReq.type].label},{' '}
                  {fmtDate(cancelReq.startDate)} → {fmtDate(cancelReq.endDate)} ({cancelReq.days} day(s)).
                  The request is marked cancelled and the days are restored to the balance.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-remarks">Reason (optional)</Label>
            <Textarea
              id="cancel-remarks"
              placeholder="e.g. Project timeline moved — leave no longer needed."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelReq(null); setRemarks(''); }}>
              Keep leave
            </Button>
            <Button variant="destructive" onClick={confirmCancel}>
              Confirm cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
