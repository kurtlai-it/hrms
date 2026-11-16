/** Payroll dates shared by the payroll tracker and Home. */
import { describe, expect, it } from 'vitest';
import { dateIn, nextPayday, paydayFor, shiftMonth, statutoryDueFor } from '../payDates';

describe('payDates', () => {
  it('places a date in the wage month or the next', () => {
    expect(dateIn('2026-11', 15, 0)).toBe('2026-11-15');
    expect(dateIn('2026-12', 15, 1)).toBe('2027-01-15');
  });

  it('pays early paydays (1–10) in the month after the wage month, later ones in the same month', () => {
    expect(paydayFor('2026-11', 7)).toBe('2026-12-07');
    expect(paydayFor('2026-11', 28)).toBe('2026-11-28');
  });

  it('makes EPF, SOCSO, EIS and PCB due on the 15th of the next month', () => {
    expect(statutoryDueFor('2026-10')).toBe('2026-11-15');
    expect(statutoryDueFor('2026-12')).toBe('2027-01-15');
  });

  it('moves between months across the year end', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('finds the next payday on or after today', () => {
    // Payday the 7th: October wages are paid on 7 Nov, November wages on 7 Dec.
    expect(nextPayday('2026-11-04', 7)).toBe('2026-11-07');
    expect(nextPayday('2026-11-07', 7)).toBe('2026-11-07');
    expect(nextPayday('2026-11-08', 7)).toBe('2026-12-07');
    // Payday the 28th: paid in the wage month itself.
    expect(nextPayday('2026-11-04', 28)).toBe('2026-11-28');
    expect(nextPayday('2026-11-29', 28)).toBe('2026-12-28');
  });
});
