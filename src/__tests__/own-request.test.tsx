/**
 * Nobody decides their own request: the leave approval list shows "Someone
 * else must approve your own request" instead of Approve / Reject on the
 * signed-in person's own row, while other people's rows keep their buttons.
 * (The decide functions refuse it too, and so does the server.)
 */
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import ApprovalsQueue from '@/pages/leave/components/ApprovalsQueue';
import { getCollection } from '@/lib/db';
import { freshDemoTenant, loginAs, renderWithProviders } from '../test/helpers';
import type { CollectionApi } from '@/lib/db';
import type { Employee, LeaveBalance } from '@/lib/types';
import type { LeaveRequestEx } from '@/pages/leave/leaveLogic';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  Toaster: () => null,
}));

const api = <T extends { id: string }>(items: T[]): CollectionApi<T> =>
  ({ items, add: vi.fn(), update: vi.fn(), remove: vi.fn(), reset: vi.fn() }) as unknown as CollectionApi<T>;

const request = (id: string, employeeId: string, reason: string): LeaveRequestEx =>
  ({
    id, employeeId, type: 'annual', startDate: '2099-01-05', endDate: '2099-01-05', days: 1,
    reason, status: 'pending', appliedAt: '2099-01-01',
  }) as LeaveRequestEx;

describe('own leave request', () => {
  beforeEach(async () => {
    await freshDemoTenant();
    loginAs('ahmad.faizal', 'manager123'); // Manager linked to emp-01 (Engineering)
  });

  it('shows the note instead of Approve / Reject on your own request only', () => {
    const employees = getCollection<Employee>('employees');
    const teammate = employees.find((e) => e.departmentId === 'dept-eng' && e.id !== 'emp-01')!;
    const leaves = [request('own', 'emp-01', 'My own day off'), request('other', teammate.id, 'Teammate day off')];
    renderWithProviders(
      <ApprovalsQueue employees={employees} leavesApi={api(leaves)} balancesApi={api<LeaveBalance>([])} />,
    );

    const ownRow = screen.getByText('My own day off').closest('tr')!;
    expect(within(ownRow).getByText('Someone else must approve your own request')).toBeInTheDocument();
    expect(within(ownRow).queryByRole('button', { name: /approve|reject/i })).toBeNull();

    const otherRow = screen.getByText('Teammate day off').closest('tr')!;
    expect(within(otherRow).getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(within(otherRow).getByRole('button', { name: /reject/i })).toBeInTheDocument();
    expect(within(otherRow).queryByText('Someone else must approve your own request')).toBeNull();
  });
});
