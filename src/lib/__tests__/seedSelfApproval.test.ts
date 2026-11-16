/**
 * Demo seed: no leave request or claim is decided by the person who made it
 * (nobody approves their own request — see useDecisions / writePolicy).
 */
import { describe, expect, it } from 'vitest';
import { buildTenantSeedData } from '../seed';
import { DEMO_COMPANY_IDS } from '../tenants';

interface Decided { id: string; employeeId: string; decidedBy?: string; status: string }

function selfDecided(companyId: string): string[] {
  const seed = buildTenantSeedData(companyId);
  const out: string[] = [];
  for (const name of ['leaves', 'claims'] as const) {
    for (const r of (seed?.collections[name] ?? []) as Decided[]) {
      if (r.decidedBy && r.decidedBy === r.employeeId) out.push(`${companyId} ${name} ${r.employeeId} ${r.status}`);
    }
  }
  return out;
}

describe('demo seed', () => {
  for (const companyId of DEMO_COMPANY_IDS) {
    it(`${companyId}: no request is decided by its own requester`, () => {
      expect(selfDecided(companyId)).toEqual([]);
    });
  }
});
