/**
 * Bank giro salary-credit file (EA 1955 s.25 — wages by bank transfer): one
 * line per employee, net pay. Shared by the statutory outputs panel and the
 * Payroll run page's "Download bank payment file" button so both produce the
 * exact same file.
 */
import { round2 } from '@/lib/utils';
import type { Employee, Payslip, Settings } from '@/lib/types';

const num2 = (n: number) => n.toFixed(2);

/** Staff whose bank name or account number is missing (their giro fields would be blank). */
export function missingBankDetails(slips: Payslip[], empMap: Map<string, Employee>): Payslip[] {
  return slips.filter((p) => {
    const e = empMap.get(p.employeeId);
    return !e?.bankName || !e?.bankAccount;
  });
}

function totalNet(slips: Payslip[]): number {
  return round2(slips.reduce((s, p) => s + p.netPay, 0));
}

/** Rows for the CSV version (header, one row per employee, total). */
export function giroCsvRows(slips: Payslip[], empMap: Map<string, Employee>, mk: string): (string | number)[][] {
  return [
    ['Bank Name', 'Account Number', 'Employee Name', 'NRIC', 'Amount (RM)', 'Reference'],
    ...slips.map((p) => {
      const e = empMap.get(p.employeeId);
      return [e?.bankName ?? '', e?.bankAccount ?? '', e?.name ?? p.employeeId, e?.ic ?? '—', num2(p.netPay), `SALARY ${mk}`];
    }),
    ['', '', 'TOTAL', '', num2(totalNet(slips)), ''],
  ];
}

/** Fixed-format TXT for bank upload: H(eader) | D(etail) lines | T(railer). */
export function giroTxt(slips: Payslip[], empMap: Map<string, Employee>, settings: Settings | undefined, mk: string): string {
  return [
    `H|${settings?.companyName ?? 'EMPLOYER'}|${settings?.companyRegNo ?? ''}|${mk}|${num2(totalNet(slips))}`,
    ...slips.map((p, i) => {
      const e = empMap.get(p.employeeId);
      return `D|${i + 1}|${e?.bankName ?? ''}|${e?.bankAccount ?? ''}|${e?.name ?? p.employeeId}|${e?.ic ?? '—'}|${num2(p.netPay)}`;
    }),
    `T|${slips.length}|${num2(totalNet(slips))}`,
  ].join('\r\n');
}
