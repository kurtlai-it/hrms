/**
 * Critical flow (b) — App shell smoke: after an admin login, the header band
 * greets the person; Home leads with "Waiting for you · <date>" and the icon grid (most
 * pages one press away, the rest under More) under a band with only Help and
 * Me. A group page shows Back + Home, and Me opens the settings panel. No
 * sidebar, no global search.
 */
import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { freshDemoTenant, loginAs } from '../test/helpers';

function renderAppAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App shell (admin)', () => {
  // App loads Home and the group page with React.lazy. A chunk's first import
  // has to transform it (recharts included), which under a full parallel test
  // run can take longer than findBy*'s 1s default. Load them once up front so
  // the assertions below measure rendering, not cold module transform time.
  beforeAll(async () => {
    await import('@/pages/dashboard');
    await import('@/pages/group/GroupPage');
  });

  beforeEach(async () => {
    await freshDemoTenant();
    loginAs('admin', 'admin123');
  });

  it('shows Home with the icon grid and a band with Help and Me', async () => {
    renderAppAt('/');

    // The work waiting is the page heading; each row's button says what it does.
    expect(await screen.findByRole('heading', { level: 1, name: /^Waiting for you · / })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Review leave: Leave to approve \(\d+\)$/ })).toHaveAttribute('href', '/approvals?tab=leave');
    expect(screen.getByRole('link', { name: /^Review claims: Expense claims to approve \(\d+\) · RM [\d,]+\.\d\d$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Go to' })).toBeInTheDocument();

    const grid = within(screen.getByRole('list', { name: 'Go to' }));
    const names = ['Leave', 'Attendance', 'Claims', 'All payslips', 'Staff', 'Run payroll', 'Reports', 'Public holidays', 'Company'];
    for (const name of names) {
      expect(grid.getByRole('link', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    expect(grid.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/more');
    expect(grid.getAllByRole('link')).toHaveLength(names.length + 1);

    // Band on Home: the greeting, Help and Me (Back/Home hidden), no sidebar or search.
    // The admin account is not linked to a staff member: "Hello" alone, no made-up name.
    const header = within(screen.getByRole('banner'));
    expect(header.getByText('Hello')).toBeInTheDocument();
    expect(header.getByRole('button', { name: 'Help' })).toBeInTheDocument();
    expect(header.getByRole('button', { name: 'Me' })).toBeInTheDocument();
    expect(header.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(header.queryByRole('link', { name: 'Home' })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('link', { name: /^Dashboard$/ })).toBeNull();
  }, 20000);

  it('a group page has Back and Home, and Me opens the settings panel', async () => {
    const user = userEvent.setup();
    renderAppAt('/go/staff');

    expect(await screen.findByRole('heading', { level: 1, name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByText('Choose one:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Find a staff member/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Contracts/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Find a staff member' })).toBeInTheDocument();

    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(header.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(header.getByText('Staff')).toBeInTheDocument();

    await user.click(header.getByRole('button', { name: 'Me' }));
    const panel = within(screen.getByRole('region', { name: 'Me' }));
    expect(panel.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(panel.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true');
    expect(panel.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();

    await user.click(header.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: /^Waiting for you · / })).toBeInTheDocument();
  }, 20000);

  it('unauthenticated visitors are redirected to /login', async () => {
    // Fresh storage, NO login.
    await freshDemoTenant();
    renderAppAt('/');

    expect(
      await screen.findByText('Welcome back', {}, { timeout: 10000 }),
    ).toBeInTheDocument();
  }, 20000);
});
