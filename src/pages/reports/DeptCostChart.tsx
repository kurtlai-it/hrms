/**
 * Stacked bar chart for the 'Payroll cost by department & cost centre' report:
 * each department's total employer cost decomposed into gross wages, employer
 * statutory (EPF/SOCSO/EIS), HRD levy and claims. Series colours 1-4, each
 * series named on its tallest bar as well as in the legend.
 */
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { DeptCostRow } from './reportBuilders';
import { CHART_LEGEND_STYLE, CHART_TICK, barNameLabel, chartLegendText } from '@/lib/chartText';

const SERIES = ['gross', 'erStatutory', 'hrd', 'claims'] as const;

const shortRM = (v: number) =>
  `RM ${Number(v).toLocaleString('en-MY', { maximumFractionDigits: 0 })}`;

export default function DeptCostChart({ rows }: { rows: DeptCostRow[] }) {
  const { t } = useTranslation();
  const data = rows.map((r) => ({
    name: r.department,
    gross: r.gross,
    erStatutory: r.erStatutory,
    hrd: r.hrd,
    claims: r.claims,
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
          <XAxis dataKey="name" tick={CHART_TICK} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={shortRM} tick={CHART_TICK} axisLine={false} tickLine={false} width={72} />
          <Tooltip
            formatter={(value: number, name: string) => [shortRM(value), name]}
            cursor={{ fill: 'hsl(var(--muted))' }}
          />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} formatter={chartLegendText} />
          {SERIES.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              name={t(`reports.chart.${k}`)}
              stackId="cost"
              fill={`hsl(var(--chart-${i + 1}))`}
              radius={i === SERIES.length - 1 ? [6, 6, 0, 0] : undefined}
              isAnimationActive={false}
            >
              <LabelList content={barNameLabel(t(`reports.chart.${k}`), data.map((d) => d[k]))} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
