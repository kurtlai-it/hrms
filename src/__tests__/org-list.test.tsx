/**
 * Phone org list (OrgList): department headings, positions with a
 * "Show N people" / "Hide" button, links to each person, and the position
 * button that opens its edit sheet.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OrgList from '@/pages/org/components/OrgList';
import type { OrgListDepartment } from '@/lib/orgList';
import type { Employee, Position } from '@/lib/types';

const pos = (id: string, title: string): Position => ({ id, title, departmentId: 'dept-eng', level: 'junior', minSalary: 1, maxSalary: 2 });
const person = (id: string, name: string, employeeNo?: string) => ({ id, name, employeeNo }) as Employee;

const groups: OrgListDepartment[] = [
  {
    id: 'dept-eng',
    name: 'Engineering',
    headcount: 3,
    positions: [
      { position: pos('pos-swe', 'Software Engineer'), people: [person('e1', 'Aisyah', 'ASM0001'), person('e2', 'Zul')] },
      { position: pos('pos-pm', 'Project Manager'), people: [person('e3', 'Mei Ling')] },
      { position: pos('pos-ba', 'Business Analyst'), people: [] },
    ],
    unplaced: [],
  },
  { id: 'dept-fin', name: 'Finance', headcount: 0, positions: [], unplaced: [] },
];

const renderList = (onOpenPosition?: (id: string) => void) =>
  render(
    <MemoryRouter>
      <OrgList groups={groups} onOpenPosition={onOpenPosition} />
    </MemoryRouter>,
  );

describe('OrgList', () => {
  it('shows each department as a heading with its headcount', () => {
    renderList();
    expect(screen.getByRole('heading', { name: /Engineering · 3 people/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Finance · 0 people/ })).toBeInTheDocument();
    expect(screen.getByText('No positions yet.')).toBeInTheDocument();
  });

  it('hides people until "Show N people" is pressed, then "Hide" closes them', async () => {
    const user = userEvent.setup();
    renderList();
    expect(screen.queryByRole('link', { name: /Aisyah/ })).not.toBeInTheDocument();

    const show = screen.getByRole('button', { name: 'Show 2 people in Software Engineer' });
    expect(show).toHaveTextContent('Show 2 people');
    expect(show).toHaveAttribute('aria-expanded', 'false');
    await user.click(show);

    const hide = screen.getByRole('button', { name: 'Hide people in Software Engineer' });
    expect(hide).toHaveTextContent('Hide');
    expect(hide).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(hide.getAttribute('aria-controls')!)!;
    expect(within(list).getByRole('link', { name: /Aisyah/ })).toHaveAttribute('href', '/employees/e1');
    expect(within(list).getByRole('link', { name: /Zul/ })).toHaveAttribute('href', '/employees/e2');

    await user.click(hide);
    expect(screen.queryByRole('link', { name: /Aisyah/ })).not.toBeInTheDocument();
  });

  it('says "1 person" for a single holder and marks empty positions as vacant', () => {
    renderList();
    expect(screen.getByRole('button', { name: 'Show 1 person in Project Manager' })).toHaveTextContent('Show 1 person');
    expect(screen.getByText('Vacant')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /in Business Analyst/ })).not.toBeInTheDocument();
  });

  it('opens a position for editing when its name is pressed', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    renderList(open);
    await user.click(screen.getByRole('button', { name: 'Project Manager' }));
    expect(open).toHaveBeenCalledWith('pos-pm');
  });

  it('shows positions as plain text when they cannot be edited', () => {
    renderList();
    expect(screen.queryByRole('button', { name: 'Project Manager' })).not.toBeInTheDocument();
    expect(screen.getByText('Project Manager')).toBeInTheDocument();
  });
});
