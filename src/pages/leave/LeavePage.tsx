/**
 * /leave — Leave hub: balances (EA 1955 entitlements), apply, approvals, team calendar.
 */
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { CalendarDays, ClipboardCheck, Plane, Wallet } from 'lucide-react';
import { useCollection } from '@/lib/db';
import type { Employee, LeaveBalance } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import BalancesPanel from './components/BalancesPanel';
import ApplyLeaveForm from './components/ApplyLeaveForm';
import ApprovalsQueue from './components/ApprovalsQueue';
import TeamCalendar from './components/TeamCalendar';
import type { LeaveRequestEx } from './leaveLogic';
import { useAuthScope } from './useAuthScope';

export default function LeavePage() {
  const { t } = useTranslation();
  const { canApprove, scopeByEmployee } = useAuthScope();
  const { items: employees } = useCollection<Employee>('employees');
  const leavesApi = useCollection<LeaveRequestEx>('leaves');
  const balancesApi = useCollection<LeaveBalance>('leaveBalances');

  const pendingCount = useMemo(
    () => scopeByEmployee(leavesApi.items, (l) => l.employeeId).filter((l) => l.status === 'pending').length,
    [leavesApi.items, scopeByEmployee],
  );

  // Seed data loads asynchronously on first launch — show a loading state.
  if (employees.length === 0) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('leavePage.title')}</h1>
        <p className="text-muted-foreground">{canApprove ? t('leavePage.introApprover') : t('leavePage.introStaff')}</p>
      </div>

      {/* Open on the job: approvers with requests waiting see Approvals, staff see Apply. */}
      <Tabs
        defaultValue={canApprove && pendingCount > 0 ? 'approvals' : canApprove ? 'balances' : 'apply'}
        className="space-y-6"
      >
        <TabsList className="flex w-full flex-wrap justify-start gap-1 sm:w-auto">
          {/* Task order: approvers see Approvals first; staff see Apply first. */}
          {canApprove && (
            <TabsTrigger value="approvals" className="gap-1.5">
              <ClipboardCheck className="h-4 w-4" /> Approvals
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1 bg-warning-soft text-warning">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="apply" className="gap-1.5">
            <Plane className="h-4 w-4" /> Apply
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-1.5">
            <Wallet className="h-4 w-4" /> Balances
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" /> Team calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balances">
          <BalancesPanel employees={employees} balancesApi={balancesApi} />
        </TabsContent>
        <TabsContent value="apply">
          <ApplyLeaveForm employees={employees} leavesApi={leavesApi} balances={balancesApi.items} />
        </TabsContent>
        <TabsContent value="approvals">
          <ApprovalsQueue employees={employees} leavesApi={leavesApi} balancesApi={balancesApi} />
        </TabsContent>
        <TabsContent value="calendar">
          <TeamCalendar employees={employees} leaves={leavesApi.items} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
