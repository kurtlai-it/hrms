import { Badge } from '@/components/ui/badge';
import type { EmployeeStatus, EmploymentType } from '@/lib/types';

const STATUS_STYLES: Record<EmployeeStatus, string> = {
  active: 'border-transparent bg-success-soft text-success',
  probation: 'border-transparent bg-warning-soft text-warning',
  resigned: 'border-transparent bg-secondary text-muted-foreground',
};

const TYPE_STYLES: Record<EmploymentType, string> = {
  'full-time': 'border-transparent bg-secondary text-foreground',
  'part-time': 'border-transparent bg-accent text-accent-foreground',
  contract: 'border-transparent bg-accent text-accent-foreground',
};

/**
 * In lists, pass `exceptionsOnly`: the normal value (Active, Full-time) is not
 * drawn as a badge (screen readers still hear it), so the badges that remain
 * mark the people who need a second look. A single person's page shows both.
 */
export function StatusBadge({ status, exceptionsOnly = false }: { status: EmployeeStatus; exceptionsOnly?: boolean }) {
  const label = status === 'active' ? 'Active' : status === 'probation' ? 'Probation' : 'Resigned';
  if (exceptionsOnly && status === 'active') return <span className="sr-only">{label}</span>;
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {label}
    </Badge>
  );
}

export function TypeBadge({ type, exceptionsOnly = false }: { type: EmploymentType; exceptionsOnly?: boolean }) {
  const label = type === 'full-time' ? 'Full-time' : type === 'part-time' ? 'Part-time' : 'Contract';
  if (exceptionsOnly && type === 'full-time') return <span className="sr-only">{label}</span>;
  return (
    <Badge variant="outline" className={TYPE_STYLES[type]}>
      {label}
    </Badge>
  );
}
