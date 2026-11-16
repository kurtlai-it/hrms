/**
 * Claims dashboard strip — KPI stat cards, current-month category donut
 * (recharts) and top claimants. Read-only; all figures derive from the
 * role-scoped claims passed in (company-wide for Admin/HR, department for
 * Manager, own claims only for Employee). Drafts never count toward KPIs,
 * the donut or the leaderboard — they are private work-in-progress.
 */
import { useMaxWidth } from '@/hooks/use-max-width';
import { Button } from '@/components/ui/button';
import { fmtDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SummaryLine } from '@/components/ui/summary-line';
import { formatDate } from '@/i18n';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { pieValueLabel } from '@/lib/chartText';
import { CircleDollarSign } from 'lucide-react';
import type { ClaimCategory, Employee } from '@/lib/types';
import { daysBetween, fmtRM, monthKey, round2 } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_COLOR, CATEGORY_LABEL, type ClaimRecord } from './claimPolicy';

interface DonutSlice {
  key: ClaimCategory;
  label: string;
  value: number;
  color: string;
}

function DonutTooltip(props: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DonutSlice }>;
}) {
  const slice = props.active ? props.payload?.[0]?.payload : undefined;
  if (!slice) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{slice.label}</p>
      <p className="text-muted-foreground">{fmtRM(slice.value)} this month</p>
    </div>
  );
}

export default function ClaimsDashboard({
  claims,
  employees,
  hideLeaderboard = false,
  onReview,
}: {
  /** Already role-scoped by the page (Employee → own claims only, etc.). */
  claims: ClaimRecord[];
  employees: Employee[];
  /** Employee role: personal stats only — the claims-waiting-by-person table is hidden. */
  hideLeaderboard?: boolean;
  /** Opens the approval queue (the "Review" button on phones). */
  onReview?: () => void;
}) {
  const { t } = useTranslation();
  // Phones: one entry per person instead of a table that scrolls sideways.
  const phone = useMaxWidth(699);
  const stats = useMemo(() => {
    const mk = monthKey();
    // Drafts are private work-in-progress, not claimed spend (B9).
    const countable = claims.filter((c) => c.status !== 'rejected' && c.status !== 'draft');
    const monthClaims = countable.filter((c) => c.claimDate.startsWith(mk));
    const monthTotal = round2(monthClaims.reduce((s, c) => s + c.amount, 0));

    const pending = claims.filter((c) => c.status === 'submitted');
    const pendingTotal = round2(pending.reduce((s, c) => s + c.amount, 0));

    const approved = claims.filter((c) => c.status === 'approved');
    const approvedTotal = round2(approved.reduce((s, c) => s + c.amount, 0));

    const decided = claims.filter(
      (c) => c.submittedAt && c.decidedAt && c.status !== 'draft' && c.status !== 'submitted',
    );
    const avgDays =
      decided.length > 0
        ? decided.reduce((s, c) => s + Math.max(0, daysBetween(c.submittedAt!, c.decidedAt!)), 0) /
          decided.length
        : 0;

    // Donut — current month totals by core category.
    const byCat = new Map<ClaimCategory, number>();
    for (const c of monthClaims) byCat.set(c.category, round2((byCat.get(c.category) ?? 0) + c.amount));
    const donut: DonutSlice[] = [...byCat.entries()]
      .map(([key, value]) => ({ key, label: CATEGORY_LABEL[key], value, color: CATEGORY_COLOR[key] }))
      .sort((a, b) => b.value - a.value);

    // Claims waiting for a decision, per person, the longest-waiting first.
    const byEmp = new Map<string, { employeeId: string; count: number; total: number; since: string }>();
    for (const c of pending) {
      const since = (c.submittedAt ?? c.claimDate).slice(0, 10);
      const row = byEmp.get(c.employeeId) ?? { employeeId: c.employeeId, count: 0, total: 0, since };
      row.count += 1;
      row.total = round2(row.total + c.amount);
      if (since < row.since) row.since = since;
      byEmp.set(c.employeeId, row);
    }
    const waiting = [...byEmp.values()].sort((a, b) => a.since.localeCompare(b.since));

    return { monthClaims, monthTotal, pending, pendingTotal, approved, approvedTotal, decided, avgDays, donut, waiting };
  }, [claims]);

  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? 'Unknown';

  const cards = [
    {
      title: t('claimsPage.claimedIn', { month: formatDate(new Date(), { month: 'long', year: 'numeric' }) }),
      value: fmtRM(stats.monthTotal),
      hint: `${stats.monthClaims.length} claim${stats.monthClaims.length === 1 ? '' : 's'} this month`,
    },
    {
      title: 'Pending approval',
      value: fmtRM(stats.pendingTotal),
      hint: `${stats.pending.length} awaiting a decision`,
    },
    {
      title: 'Approved · awaiting payroll',
      value: fmtRM(stats.approvedTotal),
      hint: `${stats.approved.length} to be reimbursed in the next run`,
    },
    {
      title: 'Avg processing time',
      value: stats.decided.length === 0 ? '—' : stats.avgDays < 1 ? '< 1 day' : `${stats.avgDays.toFixed(1)} days`,
      hint: t('claimsPage.decidedHint', { count: stats.decided.length }),
    },
  ];

  return (
    <div className="space-y-4">
      <SummaryLine items={cards.map((c) => ({ label: c.title, value: c.value, hint: c.hint }))} />

      <div className="grid grid-cols-1 gap-4">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">This month by category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.donut.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                <CircleDollarSign className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No claims recorded this month yet.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                {/* The total sits above the ring, not in the hole: at Bigger text it would run onto the ring. */}
                <div className="shrink-0 text-center">
                  <p>
                    <span className="text-xs font-bold text-muted-foreground">Total</span>{' '}
                    <span className="text-lg font-semibold">{fmtRM(stats.monthTotal)}</span>
                  </p>
                  <div className="relative h-56 w-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.donut}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={62}
                          outerRadius={92}
                          paddingAngle={2}
                          strokeWidth={0}
                          label={pieValueLabel}
                          labelLine={false}
                          isAnimationActive={false}
                        >
                          {stats.donut.map((d) => (
                            <Cell key={d.key} fill={d.color} aria-label={`${d.label}: ${fmtRM(d.value)}`} />
                          ))}
                        </Pie>
                        <Tooltip content={<DonutTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <ul className="w-full space-y-2">
                  {stats.donut.map((d) => (
                    <li key={d.key} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="min-w-0 flex-1 break-words text-muted-foreground">{d.label}</span>
                      <span className="font-medium tabular-nums">{fmtRM(d.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {!hideLeaderboard && (
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t('claimsPage.byPersonTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.waiting.length === 0 ? (
                <p className="text-muted-foreground">{t('claimsPage.byPersonNone')}</p>
              ) : (
                phone ? (
                <ul className="divide-y border-y">
                  {stats.waiting.map((w) => {
                    const name = empName(w.employeeId);
                    return (
                      <li key={w.employeeId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-[min(12rem,100%)] flex-1">
                          <p className="font-bold">{name}</p>
                          <p className="tabular-nums">{t('claimsPage.byPersonLine', { count: w.count, amount: fmtRM(w.total) })}</p>
                          <p className="text-muted-foreground">{t('claimsPage.waitingSince', { date: fmtDate(w.since) })}</p>
                        </div>
                        {onReview && (
                          <Button variant="outline" aria-label={t('claimsPage.reviewFor', { name })} onClick={onReview}>
                            {t('claimsPage.review')}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('claimsPage.byPersonName')}</TableHead>
                      <TableHead className="text-right">{t('claimsPage.byPersonCount')}</TableHead>
                      <TableHead className="text-right">{t('claimsPage.byPersonAmount')}</TableHead>
                      <TableHead>{t('claimsPage.byPersonOldest')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.waiting.map((w) => (
                      <TableRow key={w.employeeId}>
                        <TableCell className="font-medium">{empName(w.employeeId)}</TableCell>
                        <TableCell className="text-right tabular-nums">{w.count}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtRM(w.total)}</TableCell>
                        <TableCell>{fmtDate(w.since)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
