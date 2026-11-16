/**
 * Payroll run page money columns: Pay before deductions − Deductions +
 * Claims paid back = Take-home pay, to the sen, for every row and for the
 * totals — on real engine output (seeded demo company) and on payslips that
 * carry refunds, loan instalments and deduction adjustments. Pay before
 * deductions is always the payslip's gross pay.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { installLocalStorage } from '@/lib/__tests__/storageStub';
import { getCollection, seedTenantIfEmpty, setActiveTenantId } from '@/lib/db';
import { runPayroll } from '@/lib/payrollEngine';
import { COMPANY_ID_ASM } from '@/lib/tenants';
import { monthKey } from '@/lib/utils';
import type { Payslip } from '@/lib/types';
import { hasClaimsBack, summarizePayslip, sumPayslips } from '../runSummary';

const sen = (n: number) => Math.round(n * 100);

function expectFoots(slips: Payslip[]) {
  for (const p of slips) {
    const s = summarizePayslip(p);
    expect(sen(s.payBefore) - sen(s.deductions) + sen(s.claimsBack), p.employeeId).toBe(sen(s.takeHome));
    expect(s.payBefore).toBe(p.grossPay);
    expect(s.takeHome).toBe(p.netPay);
  }
  const t = sumPayslips(slips);
  expect(sen(t.payBefore) - sen(t.deductions) + sen(t.claimsBack)).toBe(sen(t.takeHome));
}

describe('runSummary on engine output', () => {
  let slips: Payslip[] = [];

  beforeAll(async () => {
    installLocalStorage();
    await seedTenantIfEmpty(COMPANY_ID_ASM, true);
    setActiveTenantId(COMPANY_ID_ASM);
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    runPayroll(monthKey(prev), undefined, 'test');
    runPayroll(monthKey(), undefined, 'test');
    slips = getCollection<Payslip>('payslips');
  });

  it('runs payroll for the seeded staff, some with claims paid back', () => {
    expect(slips.length).toBeGreaterThan(20);
    expect(hasClaimsBack(slips)).toBe(true);
  });

  it('every row and the totals foot to the sen', () => {
    expectFoots(slips);
  });
});

describe('runSummary with refunds, loans and adjustments', () => {
  const base = {
    runId: 'r', monthKey: '2026-10', unpaidLeaveDeduction: 0, otHours: 0, socsoCategory: 1 as const,
    epfEmployer: 0, socsoEmployer: 0, eisEmployer: 0, hrdLevy: 0, employerCost: 0, lines: [],
    ytd: { gross: 0, epf: 0, socso: 0, pcb: 0, net: 0 },
  };
  // net = gross − staff EPF/SOCSO/EIS − PCB − adjDed − loans + claims + adjReimb + benefitReimb
  const slip = (id: string, x: Partial<Payslip>): Payslip => {
    const p = { ...base, id, employeeId: id, basicPay: 0, otPay: 0, allowances: 0, claimsTotal: 0,
      grossPay: 0, epfEmployee: 0, socsoEmployee: 0, eisEmployee: 0, pcb: 0, netPay: 0, ...x } as Payslip;
    p.netPay = Math.round((p.grossPay - p.epfEmployee - p.socsoEmployee - p.eisEmployee - p.pcb
      - (p.adjustmentDeductions ?? 0) - (p.loanDeductionTotal ?? 0)
      + p.claimsTotal + (p.adjustmentReimbursements ?? 0) + (p.benefitReimbursements ?? 0)) * 100) / 100;
    return p;
  };

  it('keeps gross as pay before deductions and shows refunds as claims paid back', () => {
    const p = slip('a', {
      grossPay: 5123.45, epfEmployee: 563.58, socsoEmployee: 24.75, eisEmployee: 9.9, pcb: 211.35,
      adjustmentDeductions: 50, loanDeductionTotal: 300.33,
      claimsTotal: 88.8, adjustmentReimbursements: 12.34, benefitReimbursements: 100,
    });
    const s = summarizePayslip(p);
    expect(s.payBefore).toBe(5123.45);
    expect(s.claimsBack).toBe(201.14);
    expect(s.otherDeductions).toBe(350.33);
    expect(s.deductions).toBe(1159.91);
    expect(s.takeHome).toBe(4164.68);
    expectFoots([p, slip('b', { grossPay: 1700, epfEmployee: 187 }), slip('c', { grossPay: 0.01 })]);
  });

  it('reads loan instalments from loanDeductions when the total is missing', () => {
    const p = slip('d', {
      grossPay: 3000, epfEmployee: 330,
      loanDeductions: [
        { loanId: 'l1', refNo: 'L1', scheduled: 100, applied: 100, deferred: 0 },
        { loanId: 'l2', refNo: 'L2', scheduled: 50.25, applied: 50.25, deferred: 0 },
      ],
    });
    p.netPay = 2519.75; // 3000 − 330 − 150.25
    expect(summarizePayslip(p).otherDeductions).toBe(150.25);
    expectFoots([p]);
  });

  it('says whether any row pays claims back', () => {
    expect(hasClaimsBack([slip('e', { grossPay: 2000 })])).toBe(false);
    expect(hasClaimsBack([slip('e', { grossPay: 2000 }), slip('f', { grossPay: 2000, claimsTotal: 0.01 })])).toBe(true);
  });
});
