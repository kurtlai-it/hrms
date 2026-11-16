/**
 * e-Claims module — /claims.
 * Compose: the work first (My claims / Approvals tabs), then this month's
 * figures, chart and claims waiting by person; payroll &
 * MyInvois notes. Submission form lives in a dialog shared by the header
 * button and the list's edit action.
 *
 * Scoping (Wave 2): once <AuthProvider> is wired, the session drives role and
 * identity — Employee sees only their own claims and personal dashboard stats
 * (no company-wide totals or leaderboard), a Manager gets department-scoped
 * stats and a department-scoped approver inbox, Admin/HR see everything.
 * decidedBy/audit always use the logged-in user, never the acting-as stub.
 * Until the provider lands, the legacy role stub + acting-as selector drive
 * the same rules so the demo keeps working.
 */
import { fmtRM } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { Plus, UserRound } from 'lucide-react';
import type { Employee } from '@/lib/types';
import { useCollection } from '@/lib/db';
import { useRole } from '@/lib/useRole';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ApproverInbox from './ApproverInbox';
import ClaimFormDialog from './ClaimFormDialog';
import ClaimsDashboard from './ClaimsDashboard';
import MyClaimsList from './MyClaimsList';
import { useAuthSafe } from '@/lib/useAuthSafe';
import {
  resolvePolicy, type ClaimPolicyDoc, type ClaimRecord,
} from './claimPolicy';
import { getActingAsId, setActingAsId as persistActingAsId } from './actingAsStorage';

const DEFAULT_EMP_ID = 'emp-13'; // Deepak (Sales) — a frequent claimant in the seed data

export default function ClaimsPage() {
  const { t } = useTranslation();
  const { role: stubRole } = useRole();
  const auth = useAuthSafe();
  // A logged-in session wins over the legacy stub; logged-out (or the provider
  // not being wired yet) falls back to the stub so the demo stays usable.
  const session = auth?.user ? auth : null;
  const role = session?.role ?? stubRole;

  const { items: claims } = useCollection<ClaimRecord>('claims');
  const { items: employees } = useCollection<Employee>('employees');
  const { items: settingsDocs } = useCollection<ClaimPolicyDoc>('settings');

  const [actingAsId, setActingAsId] = useState<string>(
    // Per-tenant pointer (audit L2) — see actingAsStorage.ts.
    () => getActingAsId() || DEFAULT_EMP_ID,
  );
  // null until someone picks a tab: then the page opens on the job (see activeTab).
  const [tab, setTab] = useState<'my' | 'approvals' | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClaimRecord | null>(null);

  // Brief grace window while the async seed resolves on first launch.
  const [grace, setGrace] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setGrace(false), 600);
    return () => clearTimeout(t);
  }, []);
  const loading = grace && employees.length === 0;

  // Role downgraded to Employee while viewing the approvals tab → bounce back.
  // Render-phase adjust (single conditional setState) — no effect needed.
  const canApprove = role !== 'Employee';
  if (!canApprove && tab === 'approvals') {
    setTab('my');
  }

  useEffect(() => {
    persistActingAsId(actingAsId); // per-tenant key (audit L2)
  }, [actingAsId]);

  // Legacy demo identity — only consulted while no auth session exists.
  const actingEmployee = useMemo(
    () => employees.find((e) => e.id === actingAsId) ?? employees[0],
    [employees, actingAsId],
  );

  // Auth identity — the employee record linked to the logged-in account.
  const authEmployee = useMemo(
    () => employees.find((e) => e.id === session?.employeeId),
    [employees, session?.employeeId],
  );

  /** Whose claims "My claims" shows. Null = account not linked to an employee. */
  const viewEmployee: Employee | null = session ? authEmployee ?? null : actingEmployee ?? null;

  /**
   * Approver identity for decidedBy + audit. With a session this is the
   * logged-in user (linked employee id, or the user id for standalone
   * Admin/HR accounts) — never the impersonated acting-as employee.
   */
  const actor = useMemo<{ id: string; name: string }>(() => {
    if (session?.user) {
      return {
        id: session.employeeId ?? session.user.id,
        name: authEmployee?.name ?? session.user.username,
      };
    }
    return actingEmployee
      ? { id: actingEmployee.id, name: actingEmployee.name }
      : { id: 'unknown', name: 'Unknown' };
  }, [session, authEmployee, actingEmployee]);

  const policy = useMemo(() => resolvePolicy(settingsDocs), [settingsDocs]);

  /** Claims visible to the current role (Admin/HR all, Manager dept, Employee own). */
  const scopedClaims = useMemo(() => {
    if (session) return session.scopeByEmployee(claims, (c) => c.employeeId);
    // Legacy fallback — same rules, driven by the role stub + acting-as employee.
    if (role === 'Employee') return claims.filter((c) => c.employeeId === actingEmployee?.id);
    if (role === 'Manager' && actingEmployee) {
      const deptIds = new Set(
        employees.filter((e) => e.departmentId === actingEmployee.departmentId).map((e) => e.id),
      );
      return claims.filter((c) => deptIds.has(c.employeeId));
    }
    return claims;
  }, [session, claims, role, actingEmployee, employees]);

  /** Employee directory rows visible to the current role (names/avatars only). */
  const scopedEmployees = useMemo(() => {
    if (session) return session.scopeEmployees(employees);
    if (role === 'Employee') return employees.filter((e) => e.id === actingEmployee?.id);
    if (role === 'Manager' && actingEmployee) {
      return employees.filter((e) => e.departmentId === actingEmployee.departmentId);
    }
    return employees;
  }, [session, employees, role, actingEmployee]);

  const myClaims = useMemo(
    () => claims.filter((c) => c.employeeId === viewEmployee?.id),
    [claims, viewEmployee?.id],
  );

  // Badge = claims this approver can actually decide (scoped, minus their own).
  const pendingClaims = useMemo(
    () => scopedClaims.filter((c) => c.status === 'submitted' && c.employeeId !== actor.id),
    [scopedClaims, actor.id],
  );
  const pendingCount = pendingClaims.length;
  const pendingTotal = pendingClaims.reduce((sum, c) => sum + c.amount, 0);

  // Approvers with claims waiting (or with no claims of their own) open on the queue.
  const activeTab: 'my' | 'approvals' =
    tab ?? (canApprove && (pendingCount > 0 || !viewEmployee) ? 'approvals' : 'my');

  function reviewWaiting() {
    setTab('approvals');
    document.getElementById('claims-tabs')?.scrollIntoView({ block: 'start' });
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(c: ClaimRecord) {
    setEditing(c);
    setFormOpen(true);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <Card className="rounded-xl">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No employees found — the employee directory has not been seeded yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('claimsPage.title')}</h1>
          <p className="text-muted-foreground">{canApprove ? t('claimsPage.introApprover') : t('claimsPage.introStaff')}</p>
          {canApprove && pendingCount > 0 && (
            <p className="font-bold">{t('claimsPage.waitingSentence', { count: pendingCount, amount: fmtRM(pendingTotal) })}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Acting-as is the pre-auth demo stub — hidden once a session exists. */}
          {!session && (
            <div className="flex items-center gap-1.5">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <Select value={actingEmployee?.id ?? actingAsId} onValueChange={setActingAsId}>
                <SelectTrigger className="w-[210px]" aria-label="Acting as employee">
                  <SelectValue placeholder="Acting as…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {viewEmployee && (
            <Button variant={canApprove && pendingCount > 0 ? 'outline' : 'default'} onClick={openNew}>
              <Plus className="h-4 w-4" /> New claim
            </Button>
          )}
          {canApprove && pendingCount > 0 && (
            <Button onClick={reviewWaiting}>{t('claimsPage.reviewN', { count: pendingCount })}</Button>
          )}
        </div>
      </div>

      <Tabs id="claims-tabs" className="scroll-mt-28" value={activeTab} onValueChange={(v) => setTab(v as 'my' | 'approvals')}>
        <TabsList>
          <TabsTrigger value="my" className="gap-1.5">
            My claims
            <Badge variant="secondary" className="px-1.5">{myClaims.length}</Badge>
          </TabsTrigger>
          {canApprove && (
            <TabsTrigger value="approvals" className="gap-1.5">
              Approvals
              {pendingCount > 0 && (
                <Badge className="bg-primary px-1.5 text-primary-foreground hover:bg-primary">{pendingCount}</Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="my" className="mt-4">
          {viewEmployee ? (
            <MyClaimsList claims={myClaims} employee={viewEmployee} onNew={openNew} onEdit={openEdit} />
          ) : (
            <Card className="rounded-xl">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t('claimsPage.notLinked')}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        {canApprove && (
          <TabsContent value="approvals" className="mt-4">
            <ApproverInbox actor={actor} policy={policy} claims={scopedClaims} />
          </TabsContent>
        )}
      </Tabs>

      {/* ── The month's figures, after the work (role-scoped; Employee sees own only) ── */}
      <section aria-labelledby="claims-month" className="space-y-3">
        <h2 id="claims-month" className="text-[1.2rem] font-bold">{t('claimsPage.thisMonth')}</h2>
        <ClaimsDashboard
          claims={scopedClaims}
          employees={scopedEmployees}
          hideLeaderboard={role === 'Employee'}
          onReview={canApprove ? reviewWaiting : undefined}
        />

        {/* ── Tabs: my claims + approver inbox ── */}
      </section>

      {/* How approved claims reach the payslip, and receipt keeping, are in Help (help.tips.claims). */}

      {viewEmployee && (
        <ClaimFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          employee={viewEmployee}
          claims={scopedClaims}
          policy={policy}
          editing={editing}
        />
      )}
    </div>
  );
}
