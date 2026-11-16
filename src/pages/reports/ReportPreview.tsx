/**
 * M8 — Responsive report preview: shadcn Table on md+, stacked cards below.
 * Money columns go through fmtRM; the compliance "status" column renders as
 * colored badges; totals rows are emphasised.
 */
import { useTranslation } from 'react-i18next';
import type { BuiltReport, ReportColumn, ReportRow } from './reportBuilders';
import { cn, fmtRM } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

/** Builder status text -> locale key (reports.status.*); CSV keeps the builder text. */
const STATUS_KEY: Record<string, string> = {
  Pass: 'pass',
  Review: 'review',
  'Action required': 'actionRequired',
  'Not due': 'notDue',
  Pending: 'pending',
};

const STATUS_STYLES: Record<string, string> = {
  Pass: 'border-transparent bg-success-soft text-success hover:bg-success-soft',
  Review: 'border-transparent bg-warning-soft text-warning hover:bg-warning-soft',
  'Action required': 'border-transparent bg-danger-soft text-destructive hover:bg-danger-soft',
  'Not due': 'border-transparent bg-secondary text-foreground hover:bg-secondary',
  Pending: 'border-transparent bg-warning-soft text-warning hover:bg-warning-soft',
};

function cellText(col: ReportColumn, row: ReportRow): string {
  const v = row[col.key];
  if (v == null || v === '') return '—';
  if (col.format === 'money' && typeof v === 'number') return fmtRM(v);
  if (col.format === 'number' && typeof v === 'number') {
    return v.toLocaleString('en-MY', {
      minimumFractionDigits: col.decimals ?? 0,
      maximumFractionDigits: col.decimals ?? 2,
    });
  }
  return String(v);
}

function CellValue({ report, col, row }: { report: BuiltReport; col: ReportColumn; row: ReportRow }) {
  const { t } = useTranslation();
  if (report.statusKey === col.key) {
    const raw = String(row[col.key] ?? '');
    const key = STATUS_KEY[raw];
    return <Badge className={cn('font-medium', STATUS_STYLES[raw])}>{key ? t(`reports.status.${key}`) : raw}</Badge>;
  }
  return <>{cellText(col, row)}</>;
}

export default function ReportPreview({ report }: { report: BuiltReport }) {
  const { t } = useTranslation();
  // On-screen headers follow the UI language; the CSV keeps the builder labels.
  const head = (c: ReportColumn) => t(`reports.col.${c.key}`, { defaultValue: c.label });
  const firstKey = report.columns[0]?.key ?? '';

  if (report.rows.length === 0) {
    return null; // pages render their own empty state
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {report.columns.map((c) => (
                <TableHead key={c.key} className={cn(c.align === 'right' && 'text-right')}>
                  {head(c)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row, i) => (
              <TableRow key={i}>
                {report.columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn(
                      c.align === 'right' && 'text-right tabular-nums',
                      c.key === firstKey && 'font-medium',
                    )}
                  >
                    <CellValue report={report} col={c} row={row} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {report.totalRow && (
            <TableFooter>
              <TableRow>
                {report.columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn('font-semibold', c.align === 'right' && 'text-right tabular-nums')}
                  >
                    {cellText(c, report.totalRow ?? {})}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {report.rows.map((row, i) => (
          <div key={i} className="space-y-2 rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold">{cellText(report.columns[0], row)}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {report.columns.slice(1).map((c) => (
                <div key={c.key} className="flex items-baseline justify-between gap-2">
                  <dt className="shrink-0 text-xs text-muted-foreground">{head(c)}</dt>
                  <dd className="text-right tabular-nums">
                    <CellValue report={report} col={c} row={row} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {report.totalRow && (
          <div className="space-y-2 rounded-xl border border-warning/40 bg-warning-soft p-4">
            <p className="text-sm font-semibold">{cellText(report.columns[0], report.totalRow)}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {report.columns.slice(1).map((c) => (
                <div key={c.key} className="flex items-baseline justify-between gap-2">
                  <dt className="shrink-0 text-xs text-muted-foreground">{head(c)}</dt>
                  <dd className="text-right font-medium tabular-nums">{cellText(c, report.totalRow ?? {})}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </>
  );
}
