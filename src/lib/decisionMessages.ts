/**
 * Messages shown after an approval decision. They say who, what and how
 * much, and only what the app really does next: approved leave updates the
 * leave balance; approved claims wait for payroll; approved overtime counts
 * in the payroll run that covers its date. The app does not notify the
 * person, so the messages never say so.
 */
import i18n, { formatDate } from '@/i18n';

const t = (key: string, opts: Record<string, unknown>) => i18n.t(key, opts);
const day = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' });

/** "A, B and C" (or "A, B and 2 others") for up to three names. */
function nameList(names: string[]): string {
  if (names.length <= 3) return names.join(', ');
  return t('msg.namesMore', { names: names.slice(0, 2).join(', '), count: names.length - 2 });
}

export function leaveDecidedMessage(name: string, approved: boolean, from: string, to: string, days: number): string {
  return approved
    ? t('msg.leaveApproved', { name, from: day(from), to: day(to), count: days })
    : t('msg.leaveRejected', { name, from: day(from), to: day(to) });
}

export function leaveBulkApprovedMessage(names: string[]): string {
  return t('msg.leaveBulkApproved', { count: names.length, names: nameList(names) });
}

export function claimApprovedMessage(name: string, amount: string): string {
  return t('msg.claimApproved', { name, amount });
}

export function claimsApprovedMessage(count: number, total: string): string {
  return t('msg.claimsApproved', { count, amount: total });
}

export function claimRejectedMessage(name: string, amount: string): string {
  return t('msg.claimRejected', { name, amount });
}

export function otDecidedMessage(name: string, approved: boolean, hours: number, date: string): string {
  return t(approved ? 'msg.otApproved' : 'msg.otRejected', { name, hours, date: day(date) });
}

export function otBulkApprovedMessage(count: number): string {
  return t('msg.otBulkApproved', { count });
}
