/**
 * Plain-words view of a payslip for the Payroll run page. Display only — it
 * re-groups the fields the payroll engine already stored and never changes a
 * calculation.
 *
 * The engine pays: gross − staff EPF/SOCSO/EIS − PCB − deduction adjustments
 * − loan instalments + claim refunds + other cash refunds = net pay, so on
 * screen: Pay before deductions (= the payslip's gross) − Deductions +
 * Claims paid back = Take-home pay, to the sen.
 */
import { round2 } from '@/lib/utils';
import type { Payslip } from '@/lib/types';

export interface PayslipSummary {
  /** The payslip's gross pay (basic + allowances + overtime + taxable benefit wages). */
  payBefore: number;
  /** Staff EPF + SOCSO + EIS + PCB + deduction adjustments + loan instalments. */
  deductions: number;
  /** Deduction adjustments + loan instalments (shown as "Other deductions"). */
  otherDeductions: number;
  /** Claim refunds + cash adjustments + benefit reimbursements paid with the salary. */
  claimsBack: number;
  /** The engine's net pay. */
  takeHome: number;
}

export function loanTotal(p: Payslip): number {
  return p.loanDeductionTotal ?? round2((p.loanDeductions ?? []).reduce((s, d) => s + d.applied, 0));
}

export function summarizePayslip(p: Payslip): PayslipSummary {
  const otherDeductions = round2((p.adjustmentDeductions ?? 0) + loanTotal(p));
  return {
    payBefore: p.grossPay,
    deductions: round2(p.epfEmployee + p.socsoEmployee + p.eisEmployee + p.pcb + otherDeductions),
    otherDeductions,
    claimsBack: round2(p.claimsTotal + (p.adjustmentReimbursements ?? 0) + (p.benefitReimbursements ?? 0)),
    takeHome: p.netPay,
  };
}

/** True when at least one payslip pays back claims or other cash refunds. */
export function hasClaimsBack(slips: Payslip[]): boolean {
  return slips.some((p) => summarizePayslip(p).claimsBack > 0);
}

export type RunTotals = PayslipSummary & {
  basic: number;
  allowances: number;
  ot: number;
  epfEe: number;
  epfEr: number;
  socsoEe: number;
  socsoEr: number;
  eisEe: number;
  eisEr: number;
  pcb: number;
  cost: number;
};

/** Column totals for a list of payslips (each rounded to the sen). */
export function sumPayslips(slips: Payslip[]): RunTotals {
  const sum = (fn: (p: Payslip) => number) => round2(slips.reduce((s, p) => s + fn(p), 0));
  const s = slips.map(summarizePayslip);
  const sumS = (fn: (x: PayslipSummary) => number) => round2(s.reduce((acc, x) => acc + fn(x), 0));
  return {
    payBefore: sumS((x) => x.payBefore),
    deductions: sumS((x) => x.deductions),
    otherDeductions: sumS((x) => x.otherDeductions),
    claimsBack: sumS((x) => x.claimsBack),
    takeHome: sumS((x) => x.takeHome),
    basic: sum((p) => p.basicPay),
    allowances: sum((p) => p.allowances),
    ot: sum((p) => p.otPay),
    epfEe: sum((p) => p.epfEmployee),
    epfEr: sum((p) => p.epfEmployer),
    socsoEe: sum((p) => p.socsoEmployee),
    socsoEr: sum((p) => p.socsoEmployer),
    eisEe: sum((p) => p.eisEmployee),
    eisEr: sum((p) => p.eisEmployer),
    pcb: sum((p) => p.pcb),
    cost: sum((p) => p.employerCost),
  };
}
