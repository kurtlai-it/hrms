/**
 * Calibration tab — score distribution histogram (recharts), per-manager
 * average bias flags (deviation > 0.5 on the 1–5 scale from company average)
 * and a forced-distribution guide vs actual mix.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Scale } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, LabelList,
} from 'recharts';
import type { Employee } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '@/components/ui/empty';
import {
  BANDS, BIAS_THRESHOLD_5, FORCED_DISTRIBUTION, bandFor100, score100to5, type ReviewExt,
} from './lib';
import { isFinalReview } from '@/lib/kpiEngine';
import { CHART_TICK, valueLabel } from '@/lib/chartText';

interface Props {
  employees: Employee[];
  reviews: ReviewExt[];
}

const HIST_BUCKETS: { min: number; max: number; label: string }[] = [
  { min: 0, max: 1.5, label: '< 1.5' },
  { min: 1.5, max: 2.5, label: '1.5–2.5' },
  { min: 2.5, max: 3.5, label: '2.5–3.5' },
  { min: 3.5, max: 4.5, label: '3.5–4.5' },
  { min: 4.5, max: 5.01, label: '≥ 4.5' },
];

// Low to high. Rose (lowest) and green (highest) sit at opposite ends, never side by side.
const BUCKET_COLORS = ['hsl(var(--destructive))', 'hsl(var(--chart-6))', 'hsl(var(--chart-4))', 'hsl(var(--chart-1))', 'hsl(var(--success))'];

/** Minimum reviews before a manager's average is bias-flagged. */
const BIAS_MIN_SAMPLE = 2;

export default function Calibration({ employees, reviews }: Props) {
  const periods = useMemo(
    () => [...new Set(reviews.map((r) => r.period))].sort().reverse(),
    [reviews],
  );
  const [period, setPeriod] = useState<string>('');

  const activePeriod = period || periods[0] || '';
  // Draft-free: only submitted/acknowledged reviews feed calibration (B3).
  const scoped = useMemo(
    () => reviews.filter((r) => r.period === activePeriod && isFinalReview(r)),
    [reviews, activePeriod],
  );

  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? id;

  const histogram = useMemo(() => {
    return HIST_BUCKETS.map((b, i) => ({
      label: b.label,
      count: scoped.filter((r) => {
        const s5 = score100to5(r.overallScore);
        return s5 >= b.min && s5 < b.max;
      }).length,
      fill: BUCKET_COLORS[i],
    }));
  }, [scoped]);

  const companyAvg5 = useMemo(
    () => (scoped.length ? scoped.reduce((s, r) => s + score100to5(r.overallScore), 0) / scoped.length : 0),
    [scoped],
  );

  const managerRows = useMemo(() => {
    const byManager = new Map<string, ReviewExt[]>();
    scoped.forEach((r) => {
      const list = byManager.get(r.reviewerId) ?? [];
      list.push(r);
      byManager.set(r.reviewerId, list);
    });
    return [...byManager.entries()]
      .map(([reviewerId, list]) => {
        const avg5 = list.reduce((s, r) => s + score100to5(r.overallScore), 0) / list.length;
        const dev = avg5 - companyAvg5;
        // Sample-size floor: a single review never triggers a bias flag.
        const flagged = list.length >= BIAS_MIN_SAMPLE && Math.abs(dev) > BIAS_THRESHOLD_5;
        return { reviewerId, count: list.length, avg5, dev, flagged };
      })
      .sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev));
  }, [scoped, companyAvg5]);

  const actualMix = useMemo(() => {
    return BANDS.map((b) => ({
      band: b.label,
      dot: b.dot,
      count: scoped.filter((r) => bandFor100(r.overallScore).label === b.label).length,
    }));
  }, [scoped]);

  if (periods.length === 0) {
    return (
      <Empty className="rounded-xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Scale /></EmptyMedia>
          <EmptyTitle>No scored reviews yet</EmptyTitle>
          <EmptyDescription>Create a review cycle and submit manager scores to unlock calibration.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Calibration</h2>
        </div>
        <Select value={activePeriod} onValueChange={setPeriod}>
          <SelectTrigger className="ml-auto w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {scoped.length === 0 ? (
        <Empty className="rounded-xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Scale /></EmptyMedia>
            <EmptyTitle>No scores in {activePeriod}</EmptyTitle>
            <EmptyDescription>Scores appear here once manager reviews are saved for this cycle.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Histogram */}
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base">Score distribution</CardTitle>
                <CardDescription>
                  {scoped.length} scored reviews · company average {companyAvg5.toFixed(2)} / 5
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogram} margin={{ top: 28, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={CHART_TICK} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={CHART_TICK} />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        formatter={(value) => [`${value} employees`, 'Count']}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {histogram.map((h) => (
                          <Cell key={h.label} fill={h.fill} />
                        ))}
                        <LabelList content={valueLabel()} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Manager bias */}
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base">Manager bias check</CardTitle>
                <CardDescription>
                  Flagged when a manager's average deviates more than {BIAS_THRESHOLD_5} from the company average
                  (minimum {BIAS_MIN_SAMPLE} submitted reviews; drafts excluded).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {managerRows.map((m) => (
                  <div
                    key={m.reviewerId}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border px-4 py-3',
                      m.flagged && 'border-warning/40 bg-warning-soft',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="break-words text-sm font-medium">{empName(m.reviewerId)}</div>
                      <div className="text-xs text-muted-foreground">{m.count} reviews</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{m.avg5.toFixed(2)} / 5</div>
                      <div className={cn('text-xs', m.dev > 0 ? 'text-success' : m.dev < 0 ? 'text-primary' : 'text-muted-foreground')}>
                        {m.dev > 0 ? '+' : ''}{m.dev.toFixed(2)} vs company
                      </div>
                    </div>
                    {m.flagged ? (
                      <Badge variant="secondary" className="border bg-warning-soft text-warning border-warning/40">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {m.dev > 0 ? 'Lenient' : 'Strict'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="border bg-success-soft text-success border-success/40">OK</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Forced distribution */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Forced-distribution guide</CardTitle>
              <CardDescription>
                Target mix vs actual ratings in {activePeriod}. Use in calibration sessions to nudge scores toward the guide.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { title: 'Guide', rows: FORCED_DISTRIBUTION.map((f) => ({ band: f.band, pct: f.pct, dot: f.dot })) },
                {
                  title: 'Actual',
                  rows: actualMix.map((a) => ({
                    band: a.band,
                    pct: scoped.length ? Math.round((a.count / scoped.length) * 100) : 0,
                    dot: a.dot,
                  })),
                },
              ].map((bar) => (
                <div key={bar.title} className="space-y-1.5">
                  <div className="text-xs font-bold text-muted-foreground">{bar.title}</div>
                  <div className="flex h-7 w-full overflow-hidden rounded-lg border bg-muted/40">
                    {bar.rows.map((r) => (
                      <div
                        key={r.band}
                        className={cn('flex items-center justify-center text-xs font-semibold', r.dot)}
                        style={{ width: `${r.pct}%`, minWidth: r.pct > 0 ? 44 : 0 }}
                        title={`${r.band}: ${r.pct}%`}
                      >
                        {r.pct > 0 ? `${r.pct}%` : ''}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {bar.rows.map((r) => (
                      <span key={r.band} className="flex items-center gap-1.5">
                        <span className={cn('h-2.5 w-2.5 rounded-sm', r.dot)} />
                        {r.band} {r.pct}%
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
