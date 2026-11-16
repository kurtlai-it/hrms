/**
 * Payroll steps 4–5 "Mark as done": who/when stored on the run, undo clears
 * it, drafts cannot be marked, every change is audited.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { installLocalStorage } from './storageStub';
import { getCollection, setActiveTenantId, setCollection, upsertCompany } from '../db';
import { COMPANY_ID_ASM, companySeedRecord } from '../tenants';
import type { AuditLog, PayrollRun } from '../types';
import { markRunStep, undoRunStep, withStepMarked, withStepUndone } from '../payrollSteps';

const run = (over: Partial<PayrollRun> = {}): PayrollRun => ({
  id: 'run-1',
  monthKey: '2026-10',
  status: 'finalized',
  runAt: '2026-10-25T09:00:00.000Z',
  runBy: 'admin',
  employeeCount: 3,
  totalGross: 10000,
  totalNet: 8800,
  totalEmployerCost: 11500,
  warnings: [],
  ...over,
});

describe('withStepMarked / withStepUndone (pure)', () => {
  it('stores who and when for a finalized run', () => {
    const next = withStepMarked(run(), 'staffPaid', 'Nurul Ain', '2026-11-07T08:00:00.000Z');
    expect(next.stepsDone).toEqual({ staffPaid: { by: 'Nurul Ain', at: '2026-11-07T08:00:00.000Z' } });
  });

  it('keeps the other step when marking or undoing one', () => {
    const both = withStepMarked(
      withStepMarked(run(), 'staffPaid', 'A', '2026-11-07T08:00:00.000Z'),
      'statutoryPaid', 'B', '2026-11-14T08:00:00.000Z',
    );
    const undone = withStepUndone(both, 'staffPaid');
    expect(undone.stepsDone).toEqual({ statutoryPaid: { by: 'B', at: '2026-11-14T08:00:00.000Z' } });
  });

  it('does not mark a draft run', () => {
    const draft = run({ status: 'draft' });
    expect(withStepMarked(draft, 'staffPaid', 'A', '2026-11-07T08:00:00.000Z')).toBe(draft);
  });
});

describe('markRunStep / undoRunStep (persisted + audited)', () => {
  beforeEach(() => {
    installLocalStorage();
    upsertCompany(companySeedRecord(COMPANY_ID_ASM));
    setActiveTenantId(COMPANY_ID_ASM);
    setCollection('payrollRuns', [run(), run({ id: 'run-draft', monthKey: '2026-11', status: 'draft' })]);
  });

  it('saves the mark on the run and audits it', () => {
    const now = new Date('2026-11-07T08:00:00.000Z');
    expect(markRunStep('run-1', 'staffPaid', 'Nurul Ain', now)?.stepsDone?.staffPaid).toEqual({
      by: 'Nurul Ain', at: now.toISOString(),
    });
    const stored = getCollection<PayrollRun>('payrollRuns').find((r) => r.id === 'run-1')!;
    expect(stored.stepsDone?.staffPaid?.by).toBe('Nurul Ain');
    const audit = getCollection<AuditLog>('audit').at(-1)!;
    expect(audit).toMatchObject({ action: 'payroll.step.done', entityId: 'run-1', actorName: 'Nurul Ain' });
  });

  it('undo removes the mark and audits who it was by', () => {
    markRunStep('run-1', 'statutoryPaid', 'Nurul Ain', new Date('2026-11-14T08:00:00.000Z'));
    undoRunStep('run-1', 'statutoryPaid', 'Admin');
    const stored = getCollection<PayrollRun>('payrollRuns').find((r) => r.id === 'run-1')!;
    expect(stored.stepsDone?.statutoryPaid).toBeUndefined();
    const audit = getCollection<AuditLog>('audit').at(-1)!;
    expect(audit).toMatchObject({ action: 'payroll.step.undo', actorName: 'Admin' });
    expect(audit.detail).toContain('was by Nurul Ain');
  });

  it('refuses drafts and unknown runs', () => {
    expect(markRunStep('run-draft', 'staffPaid', 'A')).toBeNull();
    expect(markRunStep('nope', 'staffPaid', 'A')).toBeNull();
    expect(getCollection<AuditLog>('audit')).toHaveLength(0);
  });
});
