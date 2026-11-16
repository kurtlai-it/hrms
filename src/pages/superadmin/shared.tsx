/** Small shared building blocks for the SuperAdmin console (warm stone/amber). */
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CompanyPlan, CompanyStatus } from '@/lib/types';
import { PLAN_LABELS } from './lib';

export function PlanBadge({ plan }: { plan: CompanyPlan }) {
  const styles: Record<CompanyPlan, string> = {
    free: 'border-transparent bg-secondary text-foreground',
    pro: 'border-transparent bg-warning-soft text-warning',
    enterprise: 'border-transparent bg-warning-soft text-warning',
  };
  return (
    <Badge variant="outline" className={styles[plan]}>
      {PLAN_LABELS[plan]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: CompanyStatus }) {
  const styles: Record<CompanyStatus, string> = {
    active: 'border-transparent bg-success-soft text-success',
    trial: 'border-transparent bg-warning-soft text-warning',
    suspended: 'border-transparent bg-danger-soft text-destructive',
  };
  const labels: Record<CompanyStatus, string> = {
    active: 'Active',
    trial: 'Trial',
    suspended: 'Suspended',
  };
  return (
    <Badge variant="outline" className={styles[status]}>
      {labels[status]}
    </Badge>
  );
}

/** Card wrapper with an amber icon, matching the Settings module pattern. */
export function SectionCard(props: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { icon: Icon, title, description, action, children } = props;
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** Headline stat tile for the system overview. */
export function StatCard(props: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  const { icon: Icon, label, value, sub, tone } = props;
  return (
    <Card className="rounded-xl">
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'shrink-0 rounded-lg p-2',
            tone ?? 'bg-warning-soft text-warning',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted-foreground">
            {label}
          </p>
          <p className="break-words text-xl font-semibold">{value}</p>
          {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Dashed empty-state box used across sections. */
export function EmptyState(props: { icon: LucideIcon; title: string; note?: string }) {
  const { icon: Icon, title, note } = props;
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {note ? <p className="max-w-[52ch] text-sm text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** Small colored dot showing a company's accent color. */
export function AccentDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}
