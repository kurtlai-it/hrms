/**
 * Home navigation: which big buttons each role sees, single-page groups going
 * straight to their page, module gating, and "at most 2 presses from Home"
 * for every NAV_ITEMS route.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { installLocalStorage } from '@/lib/__tests__/storageStub';
import { setActiveTenantId, upsertCompany } from '@/lib/db';
import { COMPANY_ID_ASM, companySeedRecord } from '@/lib/tenants';
import type { AppRole } from '@/lib/roleContext';
import { HOME_GROUPS, NAV_ITEMS, routeContext, visibleHomeGroups, visibleNavItems } from '../nav';

beforeEach(() => {
  installLocalStorage();
  upsertCompany(companySeedRecord(COMPANY_ID_ASM));
  setActiveTenantId(COMPANY_ID_ASM);
});

const tiles = (role: AppRole, superAdmin = false) =>
  visibleHomeGroups(role, superAdmin).map((g) => `${g.group.key}→${g.href}`);

describe('visibleHomeGroups', () => {
  it('Admin sees all 6 groups; Claims (one page) goes straight to /claims', () => {
    expect(tiles('Admin')).toEqual([
      'staff→/go/staff', 'time→/go/time', 'pay→/go/pay',
      'claims→/claims', 'reports→/go/reports', 'company→/go/company',
    ]);
  });

  it('HR sees all 6 groups but not Settings inside Company', () => {
    expect(tiles('HR')).toHaveLength(6);
    const company = visibleHomeGroups('HR', false).find((g) => g.group.key === 'company')!;
    expect(company.pages.map((p) => p.path)).toEqual(['/company', '/org', '/org/chart']);
  });

  it('Manager sees Leave and attendance, Pay (payslips only → direct), Claims, Reports', () => {
    expect(tiles('Manager')).toEqual([
      'time→/go/time', 'pay→/my-payslips', 'claims→/claims', 'reports→/go/reports',
    ]);
    const time = visibleHomeGroups('Manager', false).find((g) => g.group.key === 'time')!;
    expect(time.pages.map((p) => p.path)).toEqual(['/leave', '/attendance']);
  });

  it('Employee sees only Leave and attendance, Pay and Claims', () => {
    expect(tiles('Employee')).toEqual(['time→/go/time', 'pay→/my-payslips', 'claims→/claims']);
  });

  it('hides a group when its module is switched off for the company', () => {
    const co = companySeedRecord(COMPANY_ID_ASM);
    co.config.enabledModules = co.config.enabledModules.filter((m) => m !== 'payroll' && m !== 'claims');
    upsertCompany(co);
    expect(tiles('Employee')).toEqual(['time→/go/time']);
    expect(tiles('Admin').map((t) => t.split('→')[0])).not.toContain('pay');
  });

  it('every group page path is a NAV_ITEMS route', () => {
    const navPaths = new Set(NAV_ITEMS.map((i) => i.path));
    for (const g of HOME_GROUPS) for (const p of g.pages) expect(navPaths.has(p.path)).toBe(true);
  });
});

/**
 * Presses from Home to open a route (upper bound). Home itself is 0. Every
 * page of a visible group is on the "More" page (Home → More → page = 2);
 * Approvals is on More too (and 1 press via "Things to do today"); Super
 * Admin is under Me (Me → link). The org chart has its own tile in Company.
 */
function pressesFromHome(path: string, role: AppRole, superAdmin: boolean): number | null {
  if (path === '/') return 0;
  if (path === '/approvals') return 2;
  if (path === '/superadmin') return superAdmin ? 2 : null;
  for (const g of visibleHomeGroups(role, superAdmin)) {
    if (g.pages.some((p) => p.path === path)) return 2;
  }
  return null;
}

const SESSIONS: [string, AppRole, boolean][] = [
  ['SuperAdmin', 'Admin', true],
  ['Admin', 'Admin', false],
  ['HR', 'HR', false],
  ['Manager', 'Manager', false],
  ['Employee', 'Employee', false],
];

describe('presses from Home', () => {
  it('every visible NAV_ITEMS route is reachable in 2 presses', () => {
    const rows: string[] = [];
    for (const [label, role, superAdmin] of SESSIONS) {
      for (const item of visibleNavItems(role, superAdmin)) {
        const n = pressesFromHome(item.path, role, superAdmin);
        rows.push(`${label.padEnd(10)} ${item.path.padEnd(17)} ${n}`);
        expect(n, `${label} ${item.path}`).not.toBeNull();
        expect(n!, `${label} ${item.path}`).toBeLessThanOrEqual(2);
      }
    }
    console.log(`session    route             presses\n${rows.join('\n')}`);
  });
});

describe('routeContext', () => {
  it('names the top bar and picks help tips by route', () => {
    expect(routeContext('/')).toEqual({ titleKey: null, helpArea: 'home' });
    expect(routeContext('/go/pay')).toEqual({ titleKey: 'group.pay', helpArea: 'pay' });
    expect(routeContext('/employees/emp-01')).toEqual({ titleKey: 'page.findStaff.name', helpArea: 'staff' });
    expect(routeContext('/org/chart')).toEqual({ titleKey: 'page.orgChart.name', helpArea: 'company' });
    expect(routeContext('/payroll/runs/r1')).toEqual({ titleKey: 'page.runPayroll.name', helpArea: 'pay' });
    expect(routeContext('/approvals')).toEqual({ titleKey: 'nav.approvals', helpArea: 'other' });
    expect(routeContext('/go/nope').helpArea).toBe('other');
  });
});
