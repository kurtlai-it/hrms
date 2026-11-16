/** Home "Waiting for you": most urgent first, empty rows dropped, max 3 shown. */
import { describe, expect, it } from 'vitest';
import { MAX_HOME_TODOS, isPayrollDue, orderTodos, type TodoFact } from '../homeTodos';

const f = (kind: TodoFact['kind'], count = 1, extra: Partial<TodoFact> = {}): TodoFact => ({
  kind, count, href: `/${kind}`, ...extra,
});
const kinds = (facts: TodoFact[]) => orderTodos(facts).map((x) => x.kind);

describe('orderTodos', () => {
  it('puts a due payroll run first, then leave, claims, OT, onboarding', () => {
    expect(kinds([f('onboarding', 2), f('ot', 4), f('claims', 2), f('leave', 3), f('payroll', 1, { due: true })]))
      .toEqual(['payroll', 'leave', 'claims', 'ot', 'onboarding']);
  });

  it('moves payroll below the approvals while it is not due yet', () => {
    expect(kinds([f('payroll', 1, { due: false }), f('onboarding', 1), f('leave', 1)]))
      .toEqual(['leave', 'onboarding', 'payroll']);
  });

  it('puts clock-in before everything, own requests last', () => {
    expect(kinds([f('ownClaims', 2), f('ownLeave', 1), f('clockIn')])).toEqual(['clockIn', 'ownLeave', 'ownClaims']);
  });

  it('puts staff pay and EPF/SOCSO/EIS/PCB after a due payroll run and before the approvals', () => {
    expect(kinds([f('leave', 2), f('statutory'), f('staffPay'), f('payroll', 1, { due: true })]))
      .toEqual(['payroll', 'staffPay', 'statutory', 'leave']);
  });

  it('puts probation and contracts after onboarding, before a payroll run that is not due', () => {
    expect(kinds([f('payroll', 1, { due: false }), f('contracts', 2), f('probation', 3), f('onboarding', 1)]))
      .toEqual(['onboarding', 'probation', 'contracts', 'payroll']);
  });

  it('drops rows with nothing to do', () => {
    expect(kinds([f('leave', 0), f('claims', 0), f('ot', 2)])).toEqual(['ot']);
    expect(orderTodos([])).toEqual([]);
  });

  it('shows at most 3 rows; the rest go behind "See all"', () => {
    const ordered = orderTodos([f('ot'), f('claims'), f('leave'), f('onboarding'), f('payroll', 1, { due: true })]);
    expect(ordered).toHaveLength(5);
    expect(MAX_HOME_TODOS).toBe(3);
    expect(ordered.slice(0, MAX_HOME_TODOS).map((x) => x.kind)).toEqual(['payroll', 'leave', 'claims']);
  });
});

describe('isPayrollDue', () => {
  it('is due from 5 days before the cut-off', () => {
    expect(isPayrollDue(19, 25)).toBe(false);
    expect(isPayrollDue(20, 25)).toBe(true);
    expect(isPayrollDue(30, 25)).toBe(true);
  });
});
