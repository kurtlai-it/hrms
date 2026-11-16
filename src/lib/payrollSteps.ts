/**
 * Payroll month steps 4–5 ("Pay staff", "Pay EPF, SOCSO, EIS and PCB"): the
 * system cannot see bank or statutory payments happen, so HR/Admin mark them
 * done by hand. Who and when is stored on the run (PayrollRun.stepsDone) and
 * every mark / undo is audited. Only finalized runs can be marked.
 */
import { getCollection, logAudit, setCollection } from './db';
import type { PayrollRun, PayrollRunStep } from './types';

export const RUN_STEPS: PayrollRunStep[] = ['staffPaid', 'statutoryPaid'];

const STEP_LABEL: Record<PayrollRunStep, string> = {
  staffPaid: 'staff paid',
  statutoryPaid: 'EPF/SOCSO/EIS/PCB paid',
};

/** Pure: the run with `step` marked done by `by` at `at`. Drafts are returned unchanged. */
export function withStepMarked(run: PayrollRun, step: PayrollRunStep, by: string, at: string): PayrollRun {
  if (run.status !== 'finalized') return run;
  return { ...run, stepsDone: { ...run.stepsDone, [step]: { by, at } } };
}

/** Pure: the run with `step` no longer marked done. */
export function withStepUndone(run: PayrollRun, step: PayrollRunStep): PayrollRun {
  if (!run.stepsDone?.[step]) return run;
  const rest = { ...run.stepsDone };
  delete rest[step];
  return { ...run, stepsDone: rest };
}

function saveRun(next: PayrollRun): void {
  setCollection(
    'payrollRuns',
    getCollection<PayrollRun>('payrollRuns').map((r) => (r.id === next.id ? next : r)),
  );
}

/** Mark a finalized run's step done and audit it. Returns null when the run is missing or still a draft. */
export function markRunStep(runId: string, step: PayrollRunStep, by: string, now: Date = new Date()): PayrollRun | null {
  const run = getCollection<PayrollRun>('payrollRuns').find((r) => r.id === runId);
  if (!run || run.status !== 'finalized') return null;
  const next = withStepMarked(run, step, by, now.toISOString());
  saveRun(next);
  logAudit({
    actorName: by,
    action: 'payroll.step.done',
    entity: 'payrollRuns',
    entityId: runId,
    detail: `${run.monthKey}: ${STEP_LABEL[step]} marked done`,
    at: now.toISOString(),
  });
  return next;
}

/** Undo a step mark and audit it. Returns null when the run is missing. */
export function undoRunStep(runId: string, step: PayrollRunStep, by: string, now: Date = new Date()): PayrollRun | null {
  const run = getCollection<PayrollRun>('payrollRuns').find((r) => r.id === runId);
  if (!run) return null;
  const next = withStepUndone(run, step);
  saveRun(next);
  logAudit({
    actorName: by,
    action: 'payroll.step.undo',
    entity: 'payrollRuns',
    entityId: runId,
    detail: `${run.monthKey}: ${STEP_LABEL[step]} mark removed (was by ${run.stepsDone?.[step]?.by ?? 'nobody'})`,
    at: now.toISOString(),
  });
  return next;
}
