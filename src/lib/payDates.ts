/**
 * Payroll dates shared by the payroll tracker and Home. Only rules that are
 * already part of the payroll steps:
 *  - payday: the company's payday (Settings.paydayDay); early days (1–10)
 *    fall in the month after the wage month (EA: wages within 7 days after
 *    the wage period).
 *  - EPF, SOCSO, EIS and PCB: due on the 15th of the month after the wage
 *    month.
 */

/** 'YYYY-MM' + day → ISO date in that month (offset 0) or the next (offset 1). */
export function dateIn(mk: string, day: number, offset: 0 | 1): string {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y!, m! - 1 + offset, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The payday for a wage month. */
export function paydayFor(mk: string, day: number): string {
  return dateIn(mk, day, day <= 10 ? 1 : 0);
}

/** EPF, SOCSO, EIS and PCB for a wage month are due on the 15th of the next month. */
export function statutoryDueFor(mk: string): string {
  return dateIn(mk, 15, 1);
}

/** 'YYYY-MM' of the month `delta` months from `mk`. */
export function shiftMonth(mk: string, delta: number): string {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** The next payday on or after `todayIso` (ISO), from the company's payday. */
export function nextPayday(todayIso: string, day: number): string {
  const mk = todayIso.slice(0, 7);
  return [-1, 0, 1]
    .map((delta) => paydayFor(shiftMonth(mk, delta), day))
    .filter((d) => d >= todayIso)
    .sort()[0]!;
}
