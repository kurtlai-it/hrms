/**
 * Dashboard charts (recharts via the shadcn ChartContainer):
 *  - HeadcountByDepartment — bar, active employees per department
 *  - PayrollTrend          — line, employer cost over the last 6 runs
 *  - AttendanceRate        — area, daily attendance rate, last 14 days
 *  - ClaimsDonut           — donut, claim amounts by category
 */
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, XAxis, YAxis,
} from 'recharts';
import { pieValueLabel, valueLabel } from '@/lib/chartText';
import { BarChart3, CalendarClock, Donut, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useCollection } from '@/lib/db';
import { fmtRM, round2 } from '@/lib/utils';
import type { AttendanceRecord, Claim, Department, Employee, PayrollRun } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { addDays, estimateMonthlyEmployerCost, isoOf, shortDate, shortMonth } from '@/pages/dashboard/lib';

function ChartCard({
  title, description, icon: Icon, children,
}: {
  title: string;
  description: string;
  icon: typeof BarChart3;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ note }: { note: string }) {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
      <BarChart3 className="h-6 w-6 text-muted-foreground" />
      <p className="max-w-[26ch] text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

// ── Headcount by department (bar) ────────────────────────────────────────────

export function HeadcountByDepartment() {
  const { t } = useTranslation();
  const headcountConfig = {
    count: { label: t('dash.charts.employees'), color: 'hsl(var(--chart-1))' },
  } satisfies ChartConfig;
  const { scopeEmployees } = useAuth();
  const { items: employees } = useCollection<Employee>('employees');
  const { items: departments } = useCollection<Department>('departments');

  const data = useMemo(() => {
    const active = scopeEmployees(employees).filter((e) => e.status !== 'resigned');
    return departments
      .map((d) => ({ name: d.name, count: active.filter((e) => e.departmentId === d.id).length }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [employees, departments, scopeEmployees]);

  return (
    <ChartCard
      title={t('dash.charts.headcountTitle')}
      description={t('dash.charts.headcountDesc')}
      icon={BarChart3}
    >
      {data.every((d) => d.count === 0) ? (
        <EmptyChart note={t('dash.charts.headcountEmpty')} />
      ) : (
        // Horizontal bars: department names stay level and whole, and each bar
        // has its number written at the end (not colour or length alone).
        <ChartContainer config={headcountConfig} className="w-full" style={{ height: Math.max(160, data.length * 44 + 24) }}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={190} interval={0} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 6, 6, 0]} maxBarSize={30}>
              <LabelList dataKey="count" position="right" className="fill-foreground font-bold" />
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

// ── 6-month payroll cost trend (line) ────────────────────────────────────────

export function PayrollTrend() {
  const { t } = useTranslation();
  const trendConfig = {
    cost: { label: t('dash.charts.employerCost'), color: 'hsl(var(--chart-1))' },
  } satisfies ChartConfig;
  const { items: runs } = useCollection<PayrollRun>('payrollRuns');
  const { items: employees } = useCollection<Employee>('employees');

  const data = useMemo(
    () =>
      [...runs]
        .filter((r) => r.status === 'finalized')
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
        .slice(-6)
        .map((r) => ({ month: shortMonth(r.monthKey), cost: round2(r.totalEmployerCost) })),
    [runs],
  );

  return (
    <ChartCard
      title={t('dash.charts.payrollTitle')}
      description={t('dash.charts.payrollDesc')}
      icon={TrendingUp}
    >
      {data.length === 0 ? (
        <EmptyChart
          note={t('dash.charts.payrollEmpty', { amount: fmtRM(estimateMonthlyEmployerCost(employees)) })}
        />
      ) : (
        <ChartContainer config={trendConfig} className="h-[240px] w-full">
          <LineChart data={data} margin={{ left: 8, right: 24, top: 28 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => fmtRM(Number(value))} />}
            />
            <Line
              type="monotone"
              dataKey="cost"
              stroke="var(--color-cost)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--color-cost)' }}
            >
              <LabelList content={valueLabel((v) => `${Math.round(v / 1000)}k`)} />
            </Line>
          </LineChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

// ── Attendance rate, last 14 days (area) ─────────────────────────────────────

export function AttendanceRate() {
  const { t } = useTranslation();
  const attendanceConfig = {
    rate: { label: t('dash.charts.attendanceRate'), color: 'hsl(var(--chart-2))' },
  } satisfies ChartConfig;
  const { scopeByEmployee } = useAuth();
  const { items: attendance } = useCollection<AttendanceRecord>('attendance');

  const data = useMemo(() => {
    const visible = scopeByEmployee(attendance, (a) => a.employeeId);
    const today = new Date();
    const days: { day: string; rate: number | null }[] = [];
    for (let i = 13; i >= 0; i--) {
      const iso = isoOf(addDays(today, -i));
      // Scheduled = working-day records; rest days, public holidays and
      // approved-leave days are excluded so leave cannot deflate the rate.
      const recs = visible.filter(
        (a) => a.date === iso && a.status !== 'rest-day' && a.status !== 'holiday' && a.status !== 'leave',
      );
      const present = recs.filter((a) => a.status === 'present').length;
      const half = recs.filter((a) => a.status === 'half-day').length;
      days.push({
        day: shortDate(iso),
        rate: recs.length === 0 ? null : Math.round(((present + half * 0.5) / recs.length) * 1000) / 10,
      });
    }
    return days;
  }, [attendance, scopeByEmployee]);

  const anyData = data.some((d) => d.rate !== null);

  return (
    <ChartCard
      title={t('dash.charts.attendanceTitle')}
      description={t('dash.charts.attendanceDesc')}
      icon={CalendarClock}
    >
      {!anyData ? (
        <EmptyChart note={t('dash.charts.attendanceEmpty')} />
      ) : (
        <ChartContainer config={attendanceConfig} className="h-[240px] w-full">
          <AreaChart data={data} margin={{ left: 8, right: 12, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} interval={2} />
            {/* Wide enough for "100%" at the chart text size. */}
            <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} width={64} />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `${Number(value)}%`} />}
            />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="var(--color-rate)"
              fill="var(--color-rate)"
              fillOpacity={0.18}
              strokeWidth={2}
              connectNulls
            />
          </AreaChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

// ── Claims by category (donut) ───────────────────────────────────────────────

const CLAIM_COLORS: Record<Claim['category'], string> = {
  travel: 'hsl(var(--chart-1))',
  meal: 'hsl(var(--chart-2))',
  medical: 'hsl(var(--chart-3))',
  parking: 'hsl(var(--chart-4))',
  telephone: 'hsl(var(--chart-6))',
  training: 'hsl(var(--chart-5))',
  other: 'hsl(var(--chart-grid))',
};

export function ClaimsDonut() {
  const { t } = useTranslation();
  const claimsConfig = Object.fromEntries(
    Object.entries(CLAIM_COLORS).map(([cat, color]) => [cat, { label: t(`claimCategory.${cat}`), color }]),
  ) satisfies ChartConfig;
  const { scopeByEmployee } = useAuth();
  const { items: claims } = useCollection<Claim>('claims');

  const data = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const c of scopeByEmployee(claims, (cl) => cl.employeeId)) {
      byCat.set(c.category, (byCat.get(c.category) ?? 0) + c.amount);
    }
    return [...byCat.entries()]
      .map(([category, amount]) => ({
        category,
        amount: round2(amount),
        fill: `var(--color-${category})`,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [claims, scopeByEmployee]);

  const total = data.reduce((s, d) => s + d.amount, 0);
  const visibleCount = scopeByEmployee(claims, (c) => c.employeeId).length;

  return (
    <ChartCard
      title={t('dash.charts.claimsTitle')}
      description={t('dash.charts.claimsDesc', { count: visibleCount })}
      icon={Donut}
    >
      {data.length === 0 ? (
        <EmptyChart note={t('dash.charts.claimsEmpty')} />
      ) : (
        <div>
          <p className="text-center">
            <span className="text-xs font-bold text-muted-foreground">{t('dash.charts.total')}</span>{' '}
            <span className="text-lg font-semibold">{fmtRM(total)}</span>
          </p>
          <ChartContainer config={claimsConfig} className="mx-auto h-[240px] w-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="category"
                    hideLabel
                    formatter={(value) => fmtRM(Number(value))}
                  />
                }
              />
              <Pie
                data={data}
                dataKey="amount"
                nameKey="category"
                innerRadius="58%"
                outerRadius="85%"
                strokeWidth={2}
                label={pieValueLabel}
                labelLine={false}
              >
                {data.map((d) => (
                  // Recharts draws each slice as role="img"; name it for screen readers.
                  <Cell
                    key={d.category}
                    fill={d.fill}
                    aria-label={`${t(`claimCategory.${d.category}`)}: ${fmtRM(d.amount)}`}
                  />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="category" />} />
            </PieChart>
          </ChartContainer>
        </div>
      )}
    </ChartCard>
  );
}
