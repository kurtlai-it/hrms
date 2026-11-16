/**
 * The org chart as a plain list for phones: department > position > person.
 * Active staff only (resigned staff are left out, like the chart). Departments
 * by name, positions most senior first then by title, people by name. Staff
 * whose position no longer exists are listed under their department as
 * "no position"; positions and staff without a known department go in a last
 * "No department" group.
 */
import type { Department, Employee, Position } from './types';
import { activeEmployees, LEVEL_RANK } from './orgChart';

export interface OrgListPosition {
  position: Position;
  people: Employee[];
}

export interface OrgListDepartment {
  /** Department id, or '' for the "No department" group. */
  id: string;
  name: string;
  positions: OrgListPosition[];
  /** Active staff in this department whose position is not on record. */
  unplaced: Employee[];
  /** Active staff in the group (positions + unplaced). */
  headcount: number;
}

export const NO_DEPARTMENT = 'No department';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function buildOrgList(departments: Department[], positions: Position[], employees: Employee[]): OrgListDepartment[] {
  const staff = activeEmployees(employees);
  const deptIds = new Set(departments.map((d) => d.id));
  const posIds = new Set(positions.map((p) => p.id));
  const groupOf = (deptId: string) => (deptIds.has(deptId) ? deptId : '');

  const groups = new Map<string, OrgListDepartment>();
  const group = (id: string) => {
    let g = groups.get(id);
    if (!g) {
      g = { id, name: departments.find((d) => d.id === id)?.name ?? NO_DEPARTMENT, positions: [], unplaced: [], headcount: 0 };
      groups.set(id, g);
    }
    return g;
  };
  for (const d of departments) group(d.id);

  for (const position of positions) {
    const people = staff.filter((e) => e.positionId === position.id).sort(byName);
    group(groupOf(position.departmentId)).positions.push({ position, people });
  }
  for (const e of staff) {
    if (!posIds.has(e.positionId)) group(groupOf(e.departmentId)).unplaced.push(e);
  }

  const out = [...groups.values()];
  for (const g of out) {
    g.positions.sort(
      (a, b) => LEVEL_RANK[b.position.level] - LEVEL_RANK[a.position.level] || a.position.title.localeCompare(b.position.title),
    );
    g.unplaced.sort(byName);
    g.headcount = g.positions.reduce((n, p) => n + p.people.length, 0) + g.unplaced.length;
  }
  // Departments by name; the "No department" group last, and only when it has something in it.
  return out
    .filter((g) => g.id !== '' || g.positions.length || g.unplaced.length)
    .sort((a, b) => Number(a.id === '') - Number(b.id === '') || a.name.localeCompare(b.name));
}
