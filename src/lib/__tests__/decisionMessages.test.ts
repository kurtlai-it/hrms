/**
 * Decision messages: they name the person, dates or amount, say only what the
 * app really does next, and never claim the person was told.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { installLocalStorage } from './storageStub';

type I18nModule = typeof import('@/i18n');
type Messages = typeof import('../decisionMessages');
let i18nMod: I18nModule;
let m: Messages;
const realDocument = globalThis.document;

beforeAll(async () => {
  installLocalStorage();
  Object.defineProperty(globalThis, 'document', {
    value: { documentElement: { lang: '' } },
    configurable: true,
    writable: true,
  });
  i18nMod = await import('@/i18n');
  m = await import('../decisionMessages');
});
afterAll(() => {
  Object.defineProperty(globalThis, 'document', { value: realDocument, configurable: true, writable: true });
});
beforeEach(() => i18nMod.setLanguage('en'));

describe('decision messages', () => {
  it('approved leave names the person, dates and days, and says the balance is updated', () => {
    expect(m.leaveDecidedMessage('Aisyah', true, '2026-11-12', '2026-11-14', 3)).toBe(
      'Leave approved for Aisyah: 12 Nov to 14 Nov (3 days). Their leave balance is updated.',
    );
    expect(m.leaveDecidedMessage('Aisyah', true, '2026-11-12', '2026-11-12', 1)).toContain('(1 day)');
  });

  it('rejected leave says the balance is not changed', () => {
    expect(m.leaveDecidedMessage('Zul', false, '2026-11-12', '2026-11-14', 3)).toBe(
      'Leave rejected for Zul: 12 Nov to 14 Nov. Their leave balance is not changed.',
    );
  });

  it('bulk leave lists up to three names, then "and N others"', () => {
    expect(m.leaveBulkApprovedMessage(['A', 'B'])).toBe('2 leave requests approved: A, B. Leave balances are updated.');
    expect(m.leaveBulkApprovedMessage(['A', 'B', 'C', 'D', 'E'])).toContain('A, B and 3 others');
  });

  it('claims name the amount and say they wait for payroll; rejected claims are not paid', () => {
    expect(m.claimApprovedMessage('Mei Ling', 'RM 450.00')).toBe(
      'Claim approved for Mei Ling: RM 450.00. It now waits to be paid through payroll.',
    );
    expect(m.claimsApprovedMessage(4, 'RM 971.10')).toBe(
      '4 claims approved, RM 971.10 in total. They now wait to be paid through payroll.',
    );
    expect(m.claimRejectedMessage('Ravi', 'RM 75.90')).toBe('Claim rejected for Ravi: RM 75.90. It will not be paid.');
  });

  it('overtime names hours and date', () => {
    expect(m.otDecidedMessage('Ravi', true, 2, '2026-11-03')).toBe(
      'Overtime approved for Ravi: 2 h on 3 Nov. It counts in the payroll run that covers 3 Nov.',
    );
    expect(m.otBulkApprovedMessage(1)).toContain('1 overtime record approved');
  });

  it('never says the person was told, in any language', () => {
    for (const lang of ['en', 'ms', 'zh'] as const) {
      i18nMod.setLanguage(lang);
      const all = [
        m.leaveDecidedMessage('A', true, '2026-11-12', '2026-11-14', 3),
        m.leaveDecidedMessage('A', false, '2026-11-12', '2026-11-14', 3),
        m.leaveBulkApprovedMessage(['A', 'B']),
        m.claimApprovedMessage('A', 'RM 1.00'),
        m.claimsApprovedMessage(2, 'RM 2.00'),
        m.claimRejectedMessage('A', 'RM 1.00'),
        m.otDecidedMessage('A', true, 1, '2026-11-03'),
        m.otBulkApprovedMessage(2),
      ].join(' ');
      expect(all).not.toMatch(/told|notif|informed|email|diberitahu|通知/i);
    }
  });
});
