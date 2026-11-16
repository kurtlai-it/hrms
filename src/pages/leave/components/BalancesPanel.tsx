/**
 * Balances panel — per-employee EA 1955 leave entitlements & usage.
 * Entitlements are computed from joinDate (service tiers) and can be synced
 * into the `leaveBalances` collection on demand.
 */
import { useTranslation } from 'react-i18next';
import { TypeBadge } from '@/pages/employees/EmployeeBadges';
import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit, type CollectionApi } from '@/lib/db';
import { fmtDate } from '@/lib/utils';
import type { Employee, LeaveBalance } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  eaEntitlements, entitlementColumns, balanceFor, TIER_LABELS,
} from '../leaveLogic';
import { useAuthScope } from '../useAuthScope';

const CURRENT_YEAR = new Date().getFullYear();

interface Props {
  employees: Employee[];
  balancesApi: CollectionApi<LeaveBalance>;
}

export default function BalancesPanel({ employees, balancesApi }: Props) {
  const { t } = useTranslation();
  const auth = useAuthScope();
  const [selectedId, setSelectedId] = useState<string>(employees[0]?.id ?? '');
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // B2: role-scoped visibility — Employee sees only their own balances,
  // Manager their department, Admin/HR everyone.
  const active = useMemo(
    () => auth.scopeEmployees(employees).filter((e) => e.status !== 'resigned'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, auth.scopeEmployees],
  );
  const pickerLocked = auth.scoped && auth.role === 'Employee';
  const emp = active.find((e) => e.id === selectedId) ?? active[0];

  const syncOne = (target: Employee): 'updated' | 'created' => {
    const existing = balanceFor(balancesApi.items, target.id, CURRENT_YEAR);
    const cols = entitlementColumns(target, CURRENT_YEAR);
    if (existing) {
      balancesApi.update(existing.id, cols);
      return 'updated';
    }
    balancesApi.add({
      employeeId: target.id,
      year: CURRENT_YEAR,
      ...cols,
      annualUsed: 0,
      sickUsed: 0,
      hospitalizationUsed: 0,
      carriedForward: 0,
    });
    return 'created';
  };

  const onSyncOne = () => {
    if (!emp) return;
    const result = syncOne(emp);
    logAudit({
      actorName: auth.actor,
      action: 'leaveBalances.sync',
      entity: 'leaveBalances',
      entityId: emp.id,
      detail: `EA 1955 entitlements ${result} for ${emp.name} (${CURRENT_YEAR})`,
    });
    setSyncMsg(`${emp.name}: entitlements ${result} from EA 1955 tiers.`);
    toast.success(`${emp.name}: entitlements ${result} from EA 1955 tiers`);
  };

  const onSyncAll = () => {
    let updated = 0;
    let created = 0;
    active.forEach((e) => {
      if (syncOne(e) === 'updated') updated += 1;
      else created += 1;
    });
    logAudit({
      actorName: auth.actor,
      action: 'leaveBalances.sync',
      entity: 'leaveBalances',
      detail: `Bulk sync ${CURRENT_YEAR}: ${updated} updated, ${created} created for ${active.length} employees`,
    });
    setSyncMsg(`Synced ${active.length} employees — ${updated} updated, ${created} created.`);
    toast.success(`Entitlements synced — ${updated} updated, ${created} created`);
  };

  if (!emp) return null;

  const ent = eaEntitlements(emp);
  const top = ent.topUps;
  const topNote = (days: number) => (days > 0 ? ` +${days} company top-up` : '');
  const bal = balanceFor(balancesApi.items, emp.id, CURRENT_YEAR);
  const annualEntitled = (bal?.annualEntitled ?? ent.annual) + (bal?.carriedForward ?? 0);
  const annualUsed = bal?.annualUsed ?? 0;
  const sickEntitled = bal?.sickEntitled ?? ent.sick;
  const sickUsed = bal?.sickUsed ?? 0;
  const hospEntitled = bal?.hospitalizationEntitled ?? ent.hospitalization;
  const hospUsed = bal?.hospitalizationUsed ?? 0;

  return (
    <div className="space-y-6">
      {/* Employee picker + sync actions */}
      <Card className="rounded-xl">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:max-w-xs">
            <Label htmlFor="balance-employee">Employee</Label>
            {pickerLocked ? (
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">{emp.name}</div>
            ) : (
              <Select value={emp.id} onValueChange={(v) => { setSelectedId(v); setSyncMsg(null); }}>
                <SelectTrigger id="balance-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {active.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {auth.isHROrAdmin && (
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button variant="outline" onClick={onSyncOne} className="gap-1.5">
                <RefreshCw className="h-4 w-4" /> Sync EA entitlements
              </Button>
              <Button variant="outline" onClick={onSyncAll}>Sync all employees</Button>
            </div>
          )}
        </CardContent>
        {syncMsg && (
          <CardContent className="pt-0">
            <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">{syncMsg}</p>
          </CardContent>
        )}
      </Card>

      {/* Service profile */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{emp.name}</span>
        <TypeBadge type={emp.employmentType} />
        <Badge variant="outline">{TIER_LABELS[ent.tier]} service tier</Badge>
        <span className="text-muted-foreground">
          Joined {fmtDate(emp.joinDate)} · {ent.serviceYears} yrs service
          {ent.partTime ? ' · part-time proration (2010 Regulations)' : ''}
          {ent.nextTierAt ? ` · next tier from ${fmtDate(ent.nextTierAt)}` : ''}
        </span>
      </div>

      {/* This person's balances: one small table. */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('leaveBal.colType')}</TableHead>
            <TableHead className="text-right">{t('leaveBal.colEntitled')}</TableHead>
            <TableHead className="text-right">{t('leaveBal.colUsed')}</TableHead>
            <TableHead className="text-right">{t('leaveBal.colLeft')}</TableHead>
            <TableHead>{t('leaveBal.colNote')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            {
              key: 'annual',
              label: t('leaveBal.annual'),
              entitled: annualEntitled,
              used: annualUsed,
              note: bal && bal.carriedForward > 0
                ? `incl. ${bal.carriedForward} carried forward${topNote(top.annual)}`
                : `EA tier ${ent.annual - top.annual}${topNote(top.annual)}`,
            },
            { key: 'sick', label: t('leaveBal.sick'), entitled: sickEntitled, used: sickUsed, note: `EA tier ${ent.sick - top.sick}${topNote(top.sick)}` },
            { key: 'hosp', label: t('leaveBal.hosp'), entitled: hospEntitled, used: hospUsed, note: `separate 60-day aggregate${topNote(top.hospitalization)}` },
          ].map((r) => (
            <TableRow key={r.key}>
              <TableCell className="font-bold">{r.label}</TableCell>
              <TableCell className="text-right tabular-nums">{r.entitled}</TableCell>
              <TableCell className="text-right tabular-nums">{r.used}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{Math.max(0, r.entitled - r.used)}</TableCell>
              <TableCell className="whitespace-normal text-muted-foreground">{r.note}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="font-bold">{emp.gender === 'female' ? t('leaveBal.maternity') : t('leaveBal.paternity')}</TableCell>
            <TableCell className="text-right tabular-nums" colSpan={3}>
              {t('leaveBal.perConfinement', { count: emp.gender === 'female' ? ent.maternity : ent.paternity })}
            </TableCell>
            <TableCell className="whitespace-normal text-muted-foreground">
              {emp.gender === 'female'
                ? `EA 1955 s.37 — paid at ORP; allowance needs ≥ 90 days worked in the 9 months before confinement.${top.maternity > 0 ? ` Includes +${top.maternity} company top-up day(s).` : ''}`
                : `EA 1955 s.60FA — married, ≥ 12 months service, up to 5 confinements.${top.paternity > 0 ? ` Includes +${top.paternity} company top-up day(s).` : ''}`}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {/* The entitlement policy (1 January snapshot, no proration, company top-ups)
          is explained in Help (help.tips.time). */}

      {/* All-employee overview (hidden for Employee role — scoped to self) */}
      {auth.role !== 'Employee' && (
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">
            {auth.role === 'Manager' ? `My department — ${CURRENT_YEAR} balances` : `All employees — ${CURRENT_YEAR} balances`}
          </CardTitle>
          <CardDescription>
            Annual (incl. carry-forward), sick and hospitalization usage against EA entitlements
            (incl. company top-ups).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Annual</TableHead>
                  <TableHead className="text-right">Sick</TableHead>
                  <TableHead className="text-right">Hospitalization</TableHead>
                  <TableHead className="text-right">Carried fwd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((e) => {
                  const b = balanceFor(balancesApi.items, e.id, CURRENT_YEAR);
                  const en = eaEntitlements(e);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell>
                        <TypeBadge type={e.employmentType} exceptionsOnly />
                      </TableCell>
                      <TableCell className="text-right">
                        {b?.annualUsed ?? 0} / {(b?.annualEntitled ?? en.annual) + (b?.carriedForward ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">{b?.sickUsed ?? 0} / {b?.sickEntitled ?? en.sick}</TableCell>
                      <TableCell className="text-right">
                        {b?.hospitalizationUsed ?? 0} / {b?.hospitalizationEntitled ?? en.hospitalization}
                      </TableCell>
                      <TableCell className="text-right">{b?.carriedForward ?? 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {active.map((e) => {
              const b = balanceFor(balancesApi.items, e.id, CURRENT_YEAR);
              const en = eaEntitlements(e);
              return (
                <div key={e.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{e.name}</span>
                    <TypeBadge type={e.employmentType} exceptionsOnly />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {b?.annualUsed ?? 0}/{(b?.annualEntitled ?? en.annual) + (b?.carriedForward ?? 0)}
                      </div>
                      Annual
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{b?.sickUsed ?? 0}/{b?.sickEntitled ?? en.sick}</div>
                      Sick
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {b?.hospitalizationUsed ?? 0}/{b?.hospitalizationEntitled ?? en.hospitalization}
                      </div>
                      Hosp.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
