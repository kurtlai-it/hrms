/**
 * Home "Waiting for you" — pure ordering rules (useHomeTodos turns the facts
 * into sentences). Most urgent first:
 *   1. clockIn     — only matters today
 *   2. payroll     — when this month's run is due (cut-off within 5 days or past)
 *   3. staffPay    — a finished run whose staff are not marked paid (payday)
 *   4. statutory   — EPF, SOCSO, EIS and PCB not marked paid (due the 15th)
 *   5. leave       — staff waiting to plan time off
 *   6. claims      — money owed to staff
 *   7. ot          — overtime to approve
 *   8. onboarding  — new-staff forms to check
 *   9. probation   — probation ended (or ending within 14 days), not confirmed
 *  10. contracts   — contracts ending soon
 *  11. payroll     — when not yet due (earlier in the month)
 *  12. ownLeave / ownClaims — the employee's own requests waiting for a decision
 * Home shows the first MAX_HOME_TODOS rows; "Show all" opens the rest in place.
 * Dated rows only carry dates that come from data (company payday, a run's
 * month, probation and contract end dates) or the statutory rule.
 */

export type TodoKind =
  | 'clockIn'
  | 'payroll'
  | 'staffPay'
  | 'statutory'
  | 'leave'
  | 'claims'
  | 'ot'
  | 'onboarding'
  | 'probation'
  | 'contracts'
  | 'ownLeave'
  | 'ownClaims';

export interface TodoFact {
  kind: TodoKind;
  /** How many items (0 = nothing to do, the row is dropped). Payroll / clock-in use 1. */
  count: number;
  href: string;
  /** Payroll only: true once the pay cut-off is near or past. */
  due?: boolean;
  /** Payroll only: a draft run exists and needs finishing. */
  draft?: boolean;
  /** The date the row is about (ISO): payday, statutory due date, first probation or contract end. */
  date?: string;
  /** The wage month a payroll row is about ('YYYY-MM'). */
  month?: string;
  /** Probation only: true when the first end date is still ahead. */
  upcoming?: boolean;
}

export const MAX_HOME_TODOS = 3;

/** Days before the payroll cut-off from which "Run payroll" goes to the top. */
export const PAYROLL_DUE_WINDOW_DAYS = 5;

function rank(f: TodoFact): number {
  switch (f.kind) {
    case 'clockIn': return 1;
    case 'payroll': return f.due ? 2 : 11;
    case 'staffPay': return 3;
    case 'statutory': return 4;
    case 'leave': return 5;
    case 'claims': return 6;
    case 'ot': return 7;
    case 'onboarding': return 8;
    case 'probation': return 9;
    case 'contracts': return 10;
    case 'ownLeave': return 12;
    case 'ownClaims': return 13;
  }
}

/** Drop empty facts and sort most urgent first (stable for equal ranks). */
export function orderTodos(facts: TodoFact[]): TodoFact[] {
  return facts
    .filter((f) => f.count > 0)
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .map(({ f }) => f);
}

/** Is this month's payroll due? True from (cut-off − window) onwards. */
export function isPayrollDue(dayOfMonth: number, cutoffDay: number, window = PAYROLL_DUE_WINDOW_DAYS): boolean {
  return dayOfMonth >= cutoffDay - window;
}
