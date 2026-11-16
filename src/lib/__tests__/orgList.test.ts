/**
 * Phone org list: department > position > person grouping, ordering, active
 * staff only, staff without a position, and the "No department" group.
 */
import { describe, it, expect } from 'vitest';
import { buildOrgList, NO_DEPARTMENT } from '../orgList';
import type { Department, Employee, Position } from '../types';

const departments: Department[] = [
  { id: 'dept-hr', name: 'Human Resources', code: 'HR', state: 'KUL' },
  { id: 'dept-eng', name: 'Engineering', code: 'ENG', state: 'KUL' },
  { id: 'dept-fin', name: 'Finance', code: 'FIN', state: 'KUL' },
];

const positions: Position[] = [
  { id: 'pos-swe', title: 'Software Engineer', departmentId: 'dept-eng', level: 'junior', minSalary: 3500, maxSalary: 6000 },
  { id: 'pos-pm', title: 'Project Manager', departmentId: 'dept-eng', level: 'manager', minSalary: 8000, maxSalary: 14000 },
  { id: 'pos-ba', title: 'Business Analyst', departmentId: 'dept-eng', level: 'junior', minSalary: 3500, maxSalary: 6000 },
  { id: 'pos-hre', title: 'HR Executive', departmentId: 'dept-hr', level: 'junior', minSalary: 2500, maxSalary: 4500 },
  { id: 'pos-old', title: 'Old Role', departmentId: 'dept-gone', level: 'senior', minSalary: 1, maxSalary: 2 },
];

function emp(id: string, name: string, positionId: string, departmentId: string, status: Employee['status'] = 'active'): Employee {
  return {
    id, name, ic: '900101-01-1234', email: `${id}@example.com`, phone: '012-3456789',
    departmentId, positionId, role: 'employee', joinDate: '2020-01-15', state: 'KUL',
    employmentType: 'full-time', status, baseSalary: 4000, maritalStatus: 'single', children: 0,
    bankName: 'Maybank', bankAccount: '1234567890', epfNo: 'EPF', socsoNo: 'SOC', taxNo: 'TAX',
    isForeignWorker: false, dateOfBirth: '1990-01-01', gender: 'male', fixedAllowances: [],
  };
}

const employees: Employee[] = [
  emp('e1', 'Zul', 'pos-swe', 'dept-eng'),
  emp('e2', 'Aisyah', 'pos-swe', 'dept-eng'),
  emp('e3', 'Mei Ling', 'pos-pm', 'dept-eng'),
  emp('e4', 'Left Already', 'pos-swe', 'dept-eng', 'resigned'),
  emp('e5', 'Ravi', 'pos-removed', 'dept-hr'),
  emp('e6', 'Nobody Knows', 'pos-removed', 'dept-gone'),
];

describe('buildOrgList', () => {
  const list = buildOrgList(departments, positions, employees);

  it('lists departments by name, with "No department" last', () => {
    expect(list.map((g) => g.name)).toEqual(['Engineering', 'Finance', 'Human Resources', NO_DEPARTMENT]);
  });

  it('puts the most senior positions first, then by title', () => {
    const eng = list.find((g) => g.id === 'dept-eng')!;
    expect(eng.positions.map((p) => p.position.title)).toEqual(['Project Manager', 'Business Analyst', 'Software Engineer']);
  });

  it('lists active people only, by name', () => {
    const swe = list.find((g) => g.id === 'dept-eng')!.positions.find((p) => p.position.id === 'pos-swe')!;
    expect(swe.people.map((e) => e.name)).toEqual(['Aisyah', 'Zul']);
  });

  it('counts the department headcount from its positions and unplaced staff', () => {
    expect(list.find((g) => g.id === 'dept-eng')!.headcount).toBe(3);
    expect(list.find((g) => g.id === 'dept-hr')!.headcount).toBe(1);
    expect(list.find((g) => g.id === 'dept-fin')!.headcount).toBe(0);
  });

  it('keeps vacant positions (no people) in the list', () => {
    const ba = list.find((g) => g.id === 'dept-eng')!.positions.find((p) => p.position.id === 'pos-ba')!;
    expect(ba.people).toEqual([]);
  });

  it('lists staff whose position is gone under their department', () => {
    expect(list.find((g) => g.id === 'dept-hr')!.unplaced.map((e) => e.name)).toEqual(['Ravi']);
  });

  it('collects positions and staff without a known department', () => {
    const none = list.find((g) => g.id === '')!;
    expect(none.positions.map((p) => p.position.title)).toEqual(['Old Role']);
    expect(none.unplaced.map((e) => e.name)).toEqual(['Nobody Knows']);
  });

  it('leaves out the "No department" group when nothing is in it', () => {
    const clean = buildOrgList(departments, positions.slice(0, 4), employees.slice(0, 3));
    expect(clean.map((g) => g.name)).toEqual(['Engineering', 'Finance', 'Human Resources']);
  });
});
