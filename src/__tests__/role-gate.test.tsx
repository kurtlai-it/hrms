/**
 * Critical flow (e) — RoleGate: direct-URL role enforcement. An Employee
 * session typing an Admin-only route (/settings, /employees) is redirected
 * to Home; an Admin session reaches /settings. Fails closed.
 */
import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { freshDemoTenant, loginAs } from '../test/helpers';

/** Lands on the Employee's Home: greeted by first name, only their grid items. */
async function expectEmployeeHome() {
  expect(
    await screen.findByRole('heading', { level: 1, name: /^Waiting for you · / }, { timeout: 15000 }),
  ).toBeInTheDocument();
  expect(within(screen.getByRole('banner')).getByText('Hello, Siti')).toBeInTheDocument();
  const grid = within(screen.getByRole('list', { name: 'Go to' }));
  expect(grid.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/attendance', '/leave', '/claims', '/my-payslips', '/more']);
}

function renderAppAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('RoleGate (direct-URL guard)', () => {
  beforeEach(async () => {
    await freshDemoTenant();
  });

  it('employee navigating to /settings is redirected to Home', async () => {
    loginAs('siti5', 'password123'); // Employee, linked to emp-05
    renderAppAt('/settings');

    await expectEmployeeHome();
    // Settings content never rendered.
    expect(screen.queryByRole('heading', { name: /^settings$/i })).not.toBeInTheDocument();
  }, 25000);

  it('employee navigating to /employees is redirected to Home', async () => {
    loginAs('siti5', 'password123');
    renderAppAt('/employees');

    await expectEmployeeHome();
    expect(screen.queryByRole('heading', { name: /^employees$/i })).not.toBeInTheDocument();
  }, 25000);

  it('admin navigating to /settings reaches the settings page', async () => {
    loginAs('admin', 'admin123');
    renderAppAt('/settings');

    expect(
      await screen.findByRole('heading', { name: /settings/i }, { timeout: 15000 }),
    ).toBeInTheDocument();
  }, 25000);
});
