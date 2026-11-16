import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowUpDown, ListFilter, Search, UserPlus, Users } from 'lucide-react';
import { useCollection } from '@/lib/db';
import { useAuth } from '@/lib/useAuth';
import { states, stateInfo } from '@/lib/holidays';
import { fmtRM } from '@/lib/utils';
import type { Department, Employee, Position } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge, TypeBadge } from './EmployeeBadges';
import { EmployeeFormDialog } from './EmployeeFormDialog';
import { NewHireWizard } from './NewHireWizard';
import { ProbationStrip } from './ProbationStrip';
import { BulkActionBar } from './BulkActionBar';
import { SeparationMenu } from './SeparationActions';
import { deptName, maskIc, positionTitle } from './helpers';

type SortKey = 'name' | 'salary-desc' | 'salary-asc' | 'join-desc' | 'join-asc';

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name (A–Z)',
  'salary-desc': 'Salary (high → low)',
  'salary-asc': 'Salary (low → high)',
  'join-desc': 'Newest joiners',
  'join-asc': 'Longest serving',
};

export default function EmployeesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role, employeeId, scopeEmployees, user } = useAuth();
  /** Salary visibility + add/edit mutations are Admin/HR-only. */
  const isHR = role === 'Admin' || role === 'HR';
  const actorName = user?.username ?? 'HR Admin';

  const { items: employees } = useCollection<Employee>('employees');
  const { items: departments } = useCollection<Department>('departments');
  const { items: positions } = useCollection<Position>('positions');

  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [addOpen, setAddOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  /** Bulk selection — preserved across filtering; pruned only when a record vanishes. */
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  // Seed data loads asynchronously on first launch — show a brief skeleton.
  const [loading, setLoading] = useState(employees.length === 0);
  // Data arrived → stop the skeleton immediately (render-phase adjust).
  if (loading && employees.length > 0) {
    setLoading(false);
  }
  // Still empty after a grace window → stop (genuinely empty tenant).
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(t);
  }, [loading]);

  // Role scoping: Admin/HR see all; Manager sees own department only.
  const scoped = useMemo(() => scopeEmployees(employees), [employees, scopeEmployees]);

  // Salary sorts are meaningless (and leaky) when the column is hidden.
  const effectiveSort: SortKey =
    !isHR && (sort === 'salary-asc' || sort === 'salary-desc') ? 'name' : sort;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = scoped.filter((e) => {
      if (q) {
        const hay = `${e.name} ${e.ic} ${e.ic.replace(/\W/g, '')} ${e.employeeNo ?? ''} ${e.email}`.toLowerCase();
        if (!hay.includes(q) && !hay.includes(q.replace(/\W/g, ''))) return false;
      }
      if (deptFilter !== 'all' && e.departmentId !== deptFilter) return false;
      if (stateFilter !== 'all' && e.state !== stateFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (typeFilter !== 'all' && e.employmentType !== typeFilter) return false;
      return true;
    });
    const sorted = [...list];
    switch (effectiveSort) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'salary-desc':
        sorted.sort((a, b) => b.baseSalary - a.baseSalary);
        break;
      case 'salary-asc':
        sorted.sort((a, b) => a.baseSalary - b.baseSalary);
        break;
      case 'join-desc':
        sorted.sort((a, b) => b.joinDate.localeCompare(a.joinDate));
        break;
      case 'join-asc':
        sorted.sort((a, b) => a.joinDate.localeCompare(b.joinDate));
        break;
    }
    return sorted;
  }, [scoped, query, deptFilter, stateFilter, statusFilter, typeFilter, effectiveSort]);

  const hasFilters =
    query.trim() !== '' || deptFilter !== 'all' || stateFilter !== 'all' ||
    statusFilter !== 'all' || typeFilter !== 'all';

  const clearFilters = () => {
    setQuery('');
    setDeptFilter('all');
    setStateFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  // Prune selection only when records actually disappear (delete / tenant
  // switch) — filtering the table never clears it. Render-phase adjust keyed
  // on the collection identity, not an effect.
  const [prunedFor, setPrunedFor] = useState(employees);
  if (prunedFor !== employees) {
    setPrunedFor(employees);
    setSelectedIds((prev) => {
      const alive = new Set(employees.map((e) => e.id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }

  const selectedEmployees = useMemo(
    () => scoped.filter((e) => selectedIds.has(e.id)),
    [scoped, selectedIds],
  );

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const filteredIds = filtered.map((e) => e.id);
  const selectedInFilter = filteredIds.filter((id) => selectedIds.has(id)).length;
  const allFilteredSelected = filteredIds.length > 0 && selectedInFilter === filteredIds.length;

  const toggleAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  // Employee role: the directory is off-limits — land on own detail record.
  if (role === 'Employee') {
    return <Navigate to={employeeId ? `/employees/${employeeId}` : '/'} replace />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {scoped.length} on record · {scoped.filter((e) => e.status === 'probation').length} on probation ·{' '}
            {scoped.filter((e) => e.isForeignWorker).length} foreign workers
            {!isHR && ' · own department (read-only)'}
          </p>
        </div>
        {isHR && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              {t('staffList.addOneForm')}
            </Button>
            <Button onClick={() => setWizardOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              {t('staffList.addStaff')}
            </Button>
          </div>
        )}
      </div>

      {/* Search first: finding a staff member is the main job of this page. */}
      <section aria-label={t('staffList.searchLabel')} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="staff-search" className="text-[1.1rem] font-bold">{t('staffList.searchLabel')}</Label>
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="staff-search"
                type="search"
                className="h-14 pl-11 text-lg"
                placeholder={t('staffList.searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {states.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="probation">Probation</SelectItem>
                <SelectItem value="resigned">Resigned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="part-time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
              </SelectContent>
            </Select>
            <Select value={effectiveSort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[])
                  .filter((k) => isHR || (k !== 'salary-asc' && k !== 'salary-desc'))
                  .map((k) => (
                    <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" className="justify-start" onClick={clearFilters}>
                <ListFilter className="mr-1.5 h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>
      </section>

      {/* Probation needing a decision, while nobody is searching. */}
      {isHR && !query.trim() && !hasFilters && <ProbationStrip />}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <Card className="rounded-xl">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>{hasFilters ? 'No employees match' : 'No employees yet'}</EmptyTitle>
              <EmptyDescription>
                {hasFilters
                  ? 'Try widening the search or clearing the filters.'
                  : isHR
                    ? 'Add your first employee or run the guided New-Hire Wizard.'
                    : 'No employees visible in your scope.'}
              </EmptyDescription>
            </EmptyHeader>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </Empty>
        </Card>
      )}

      {/* Desktop table (md+) */}
      {!loading && filtered.length > 0 && (
        <Card className="hidden rounded-xl md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {isHR && (
                  <TableHead className="w-10">
                    <label className="flex min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center">
                      <Checkbox
                        aria-label="Select all filtered employees"
                        checked={
                          allFilteredSelected
                            ? true
                            : selectedInFilter > 0
                              ? 'indeterminate'
                              : false
                        }
                        onCheckedChange={(v) => toggleAllFiltered(v === true)}
                      />
                    </label>
                  </TableHead>
                )}
                <TableHead>Employee</TableHead>
                <TableHead>NRIC</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                {isHR && (
                  <TableHead className="text-right">
                    <button
                      type="button"
                      className="inline-flex min-h-12 items-center gap-1 transition-colors hover:text-foreground"
                      onClick={() =>
                        setSort((s) => (s === 'salary-desc' ? 'salary-asc' : 'salary-desc'))
                      }
                    >
                      Base salary <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </TableHead>
                )}
                {isHR && <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow
                  key={e.id}
                  className="cursor-pointer"
                  data-state={selectedIds.has(e.id) ? 'selected' : undefined}
                  onClick={() => navigate(`/employees/${e.id}`)}
                >
                  {isHR && (
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <label className="flex min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center">
                        <Checkbox
                          aria-label={`Select ${e.name}`}
                          checked={selectedIds.has(e.id)}
                          onCheckedChange={(v) => toggleOne(e.id, v === true)}
                        />
                      </label>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-primary">{e.name}</p>
                        <p className="break-words text-xs text-muted-foreground">{e.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{isHR ? e.ic : maskIc(e.ic)}</TableCell>
                  <TableCell>
                    <p className="text-sm">{deptName(departments, e.departmentId)}</p>
                    <p className="text-xs text-muted-foreground">{positionTitle(positions, e.positionId)}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{stateInfo(e.state).name}</TableCell>
                  <TableCell><TypeBadge type={e.employmentType} exceptionsOnly /></TableCell>
                  <TableCell><StatusBadge status={e.status} exceptionsOnly /></TableCell>
                  {isHR && <TableCell className="text-right font-medium">{fmtRM(e.baseSalary)}</TableCell>}
                  {isHR && (
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <SeparationMenu targets={[e]} actorName={actorName} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Mobile cards (<md) */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 pb-20 md:hidden">
          {filtered.map((e) => (
            <div key={e.id} className="relative">
              <Link to={`/employees/${e.id}`}>
                <Card className="rounded-xl transition-colors hover:bg-muted">
                  <CardContent className="flex flex-wrap items-center gap-3 p-4 pr-14">
                    {isHR && (
                      <div
                        data-choice-row
                        className="flex min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center"
                        onClick={(ev) => {
                          // Inside the card link: never navigate; a click beside the mark toggles too.
                          ev.preventDefault();
                          if (!(ev.target as HTMLElement).closest('[role="checkbox"]')) {
                            toggleOne(e.id, !selectedIds.has(e.id));
                          }
                        }}
                      >
                        <Checkbox
                          aria-label={`Select ${e.name}`}
                          checked={selectedIds.has(e.id)}
                          onCheckedChange={(v) => toggleOne(e.id, v === true)}
                        />
                      </div>
                    )}
                    {/* Name block keeps 11rem; with Bigger text the salary wraps below instead of squeezing it. */}
                    <div className="min-w-[min(100%,11rem)] flex-1">
                      <p className="break-words font-medium text-primary">{e.name}</p>
                      <p className="break-words text-xs text-muted-foreground">
                        {deptName(departments, e.departmentId)} · {positionTitle(positions, e.positionId)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <StatusBadge status={e.status} exceptionsOnly />
                        <TypeBadge type={e.employmentType} exceptionsOnly />
                      </div>
                    </div>
                    {isHR && (
                      <div className="ml-auto text-right">
                        <p className="whitespace-nowrap text-sm font-semibold">{fmtRM(e.baseSalary)}</p>
                        <p className="text-xs text-muted-foreground">/ month</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
              {isHR && (
                <div className="absolute right-2 top-2">
                  <SeparationMenu targets={[e]} actorName={actorName} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bulk selection bar (Admin/HR) */}
      {isHR && (
        <BulkActionBar
          selected={selectedEmployees}
          actorName={actorName}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {isHR && (
        <>
          <EmployeeFormDialog open={addOpen} onOpenChange={setAddOpen} />
          <NewHireWizard open={wizardOpen} onOpenChange={setWizardOpen} />
        </>
      )}
    </div>
  );
}
